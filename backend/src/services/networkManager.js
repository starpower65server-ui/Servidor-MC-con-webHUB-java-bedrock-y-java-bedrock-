const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const { getSetting, setSetting } = require('../db');

/**
 * Fetch JSON or text helper for external API calls.
 */
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.request(url, {
            timeout: 8000,
            headers: { 'User-Agent': 'MCServerManager/1.0', ...(options.headers || {}) },
            method: options.method || 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
        if (options.body) req.write(options.body);
        req.end();
    });
}

/**
 * Detect host's public IP address using public API services.
 */
async function getPublicIp() {
    const providers = [
        async () => JSON.parse(await fetchUrl('https://api.ipify.org?format=json')).ip,
        async () => (await fetchUrl('https://ifconfig.me/ip')).trim(),
        async () => JSON.parse(await fetchUrl('https://ipinfo.io/json')).ip
    ];

    for (const fetcher of providers) {
        try {
            const ip = await fetcher();
            if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
                return ip;
            }
        } catch { /* try next provider */ }
    }
    return null;
}

/**
 * Check what IP a custom domain resolves to using DNS lookup.
 */
async function resolveDomainIp(domain) {
    if (!domain) return null;
    try {
        const result = await dns.lookup(domain.replace(/^https?:\/\//, '').split('/')[0].trim());
        return result.address;
    } catch {
        return null;
    }
}

/**
 * Update DNS A record on Cloudflare if API token & zone ID are configured.
 */
async function syncCloudflareDns(overrideIp = null) {
    const apiToken = getSetting('cf_api_token', '');
    const zoneId = getSetting('cf_zone_id', '');
    const recordName = getSetting('cf_record_name', '') || getSetting('custom_domain', '');

    if (!apiToken || !zoneId || !recordName) {
        return { success: false, reason: 'Cloudflare not fully configured' };
    }

    const currentIp = overrideIp || await getPublicIp();
    if (!currentIp) {
        throw new Error('Could not detect public IP address');
    }

    const cleanName = recordName.replace(/^https?:\/\//, '').trim();

    // 1. Get existing DNS record ID
    const recordsUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(cleanName)}`;
    const recordsData = JSON.parse(await fetchUrl(recordsUrl, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
    }));

    if (!recordsData.success || !recordsData.result) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(recordsData.errors || recordsData)}`);
    }

    const existingRecord = recordsData.result[0];

    if (existingRecord) {
        // Update existing record
        const updateUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`;
        const updateRes = JSON.parse(await fetchUrl(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'A',
                name: cleanName,
                content: currentIp,
                ttl: 120,
                proxied: false // Proxy should be false for Minecraft traffic!
            })
        }));

        if (!updateRes.success) {
            throw new Error(`Cloudflare update failed: ${JSON.stringify(updateRes.errors)}`);
        }
        return { success: true, action: 'updated', recordId: existingRecord.id, ip: currentIp };
    } else {
        // Create new record
        const createUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
        const createRes = JSON.parse(await fetchUrl(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'A',
                name: cleanName,
                content: currentIp,
                ttl: 120,
                proxied: false
            })
        }));

        if (!createRes.success) {
            throw new Error(`Cloudflare create failed: ${JSON.stringify(createRes.errors)}`);
        }
        return { success: true, action: 'created', recordId: createRes.result.id, ip: currentIp };
    }
}

/**
 * Get current aggregate network information.
 */
async function getNetworkInfo() {
    const publicIp = await getPublicIp();
    const customDomain = getSetting('custom_domain', '');
    const cfToken = getSetting('cf_api_token', '');
    const cfZoneId = getSetting('cf_zone_id', '');
    const cfRecordName = getSetting('cf_record_name', '');

    let domainResolvedIp = null;
    let isDomainMatching = false;

    if (customDomain) {
        domainResolvedIp = await resolveDomainIp(customDomain);
        if (publicIp && domainResolvedIp === publicIp) {
            isDomainMatching = true;
        }
    }

    return {
        publicIp,
        customDomain,
        domainResolvedIp,
        isDomainMatching,
        cloudflare: {
            configured: Boolean(cfToken && cfZoneId),
            zoneId: cfZoneId,
            apiToken: cfToken ? '••••••••' + cfToken.slice(-4) : '',
            recordName: cfRecordName || customDomain
        }
    };
}

/**
 * Save network settings to database.
 */
function saveNetworkSettings(settings) {
    if (settings.customDomain !== undefined) {
        setSetting('custom_domain', settings.customDomain.trim().toLowerCase());
    }
    if (settings.cfZoneId !== undefined) {
        setSetting('cf_zone_id', settings.cfZoneId.trim());
    }
    if (settings.cfApiToken !== undefined && !settings.cfApiToken.includes('••••')) {
        setSetting('cf_api_token', settings.cfApiToken.trim());
    }
    if (settings.cfRecordName !== undefined) {
        setSetting('cf_record_name', settings.cfRecordName.trim().toLowerCase());
    }
}

module.exports = {
    getPublicIp,
    resolveDomainIp,
    syncCloudflareDns,
    getNetworkInfo,
    saveNetworkSettings
};

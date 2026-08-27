const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getBedrockDownloadUrl, USER_AGENT } = require('../utils/bedrockDownloadResolver');

const DEFAULT_HEADERS = {
    'User-Agent': USER_AGENT || 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; BEDROCK-UPDATER)'
};

// Fallback list of Bedrock Dedicated Server versions with direct download URLs.
const BEDROCK_VERSIONS = [
    { id: '1.26.44.3', windows: 'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.26.44.3.zip', linux: 'https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.44.3.zip' },
    { id: '1.21.80.3', windows: 'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.80.3.zip', linux: 'https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.80.3.zip' },
    { id: '1.21.73.01', windows: 'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.73.01.zip', linux: 'https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.73.01.zip' },
    { id: '1.21.62.01', windows: 'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.62.01.zip', linux: 'https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.62.01.zip' },
    { id: '1.21.51.01', windows: 'https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.51.01.zip', linux: 'https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.51.01.zip' },
];

/**
 * Download a file with redirect support and progress tracking.
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: DEFAULT_HEADERS }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} downloading Bedrock server from ${url}`));
            }

            const totalSize = parseInt(res.headers['content-length'], 10) || 0;
            let downloadedSize = 0;
            const file = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (onProgress && totalSize > 0) {
                    onProgress(Math.round((downloadedSize / totalSize) * 100));
                }
            });

            res.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve());
            });
            file.on('error', (err) => {
                try { fs.unlinkSync(destPath); } catch { }
                reject(err);
            });
        }).on('error', (err) => {
            try { fs.unlinkSync(destPath); } catch { }
            reject(err);
        });
    });
}

const AdmZip = require('adm-zip');

/**
 * Extract a ZIP archive natively using adm-zip with .NET fallback.
 */
function extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(destDir, { recursive: true });

        const absZip = path.resolve(zipPath);
        const absDest = path.resolve(destDir);

        try {
            const zip = new AdmZip(absZip);
            zip.extractAllTo(absDest, true);
            return resolve();
        } catch (admErr) {
            console.warn('[Bedrock] adm-zip extraction failed, trying fallback method:', admErr.message);

            let fallbackCmd;
            if (process.platform === 'win32') {
                const escapedZip = absZip.replace(/'/g, "''");
                const escapedDest = absDest.replace(/'/g, "''");
                fallbackCmd = `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedZip}', '${escapedDest}', $true)"`;
            } else {
                fallbackCmd = `unzip -o "${absZip}" -d "${absDest}"`;
            }

            exec(fallbackCmd, { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (err) => {
                if (err) return reject(new Error(`ZIP extraction failed: ${err.message}`));
                resolve();
            });
        }
    });
}

/**
 * Get available Bedrock versions.
 */
async function getBedrockVersions() {
    const list = [...BEDROCK_VERSIONS.map(v => ({ id: v.id }))];
    try {
        const platform = process.platform === 'win32' ? 'windows' : 'linux';
        const dynamicInfo = await getBedrockDownloadUrl(platform);
        if (dynamicInfo && dynamicInfo.version && dynamicInfo.version !== 'latest') {
            if (!list.some(v => v.id === dynamicInfo.version)) {
                list.unshift({ id: dynamicInfo.version });
            }
        }
    } catch (err) {
        console.warn('[Bedrock] Failed to resolve live version from Mojang API, using fallbacks:', err.message);
    }

    return {
        latest: list[0] ? list[0].id : '1.26.44.3',
        versions: list
    };
}

/**
 * Download and extract Bedrock Dedicated Server.
 */
async function downloadBedrockServer(versionId, destDir, onProgress) {
    const isWindows = process.platform === 'win32';
    const isLinux = process.platform === 'linux';

    if (!isWindows && !isLinux) {
        throw new Error('Bedrock Dedicated Server is only supported on Windows and Linux');
    }

    let downloadUrl = null;
    const platform = isWindows ? 'windows' : 'linux';

    // 1. Try dynamic resolution via Mojang Links API
    try {
        const dynamicInfo = await getBedrockDownloadUrl(platform);
        if (versionId === 'latest' || versionId === dynamicInfo.version || !versionId) {
            downloadUrl = dynamicInfo.downloadUrl;
        }
    } catch (err) {
        console.warn('[Bedrock] Dynamic resolver failed, attempting fallback list:', err.message);
    }

    // 2. Fallback to hardcoded list if not resolved yet
    if (!downloadUrl) {
        const entry = BEDROCK_VERSIONS.find(v => v.id === versionId);
        if (entry) {
            downloadUrl = isWindows ? entry.windows : entry.linux;
        } else {
            // Attempt to build standard link format
            const osPart = isWindows ? 'win' : 'linux';
            downloadUrl = `https://www.minecraft.net/bedrockdedicatedserver/bin-${osPart}/bedrock-server-${versionId}.zip`;
        }
    }

    const zipPath = path.join(destDir, 'bedrock_server.zip');

    if (onProgress) onProgress(0);
    await downloadFile(downloadUrl, zipPath, (pct) => {
        if (onProgress) onProgress(Math.round(pct * 0.9)); // 0-90% for download
    });

    if (onProgress) onProgress(92);
    await extractZip(zipPath, destDir);

    // Remove the ZIP after extraction
    try { fs.unlinkSync(zipPath); } catch { }

    // On Linux, make sure the binary is executable
    if (isLinux) {
        const binaryPath = path.join(destDir, 'bedrock_server');
        if (fs.existsSync(binaryPath)) {
            fs.chmodSync(binaryPath, 0o755);
        }
    }

    if (onProgress) onProgress(100);
}

/**
 * Generate Bedrock-specific server.properties content.
 */
function generateBedrockServerProperties(port, name) {
    return [
        `server-name=${name}`,
        `gamemode=survival`,
        `difficulty=normal`,
        `allow-cheats=false`,
        `max-players=20`,
        `online-mode=true`,
        `allow-list=false`,
        `server-port=${port}`,
        `server-portv6=19133`,
        `enable-lan-visibility=true`,
        `view-distance=10`,
        `tick-distance=4`,
        `player-idle-timeout=30`,
        `max-threads=8`,
        `level-name=Bedrock level`,
        `level-seed=`,
        `default-player-permission-level=member`,
        `texturepack-required=false`,
        `content-log-file-enabled=false`,
        `compression-threshold=1`,
        `server-authoritative-movement=server-auth`,
        `player-movement-score-threshold=20`,
        `player-movement-action-direction-threshold=0.85`,
        `player-movement-distance-threshold=0.3`,
        `player-movement-duration-threshold-in-ms=500`,
        `correct-player-movement=false`,
        `server-authoritative-block-breaking=false`,
        ``
    ].join('\n');
}

/**
 * Get the Bedrock server executable path inside a server directory.
 */
function getBedrockExecutable(serverDir) {
    if (process.platform === 'win32') {
        return path.join(serverDir, 'bedrock_server.exe');
    }
    return path.join(serverDir, 'bedrock_server');
}

module.exports = {
    getBedrockVersions,
    downloadBedrockServer,
    generateBedrockServerProperties,
    getBedrockExecutable
};


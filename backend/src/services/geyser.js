const fs = require('fs');
const path = require('path');
const https = require('https');

const GEYSER_SPIGOT_URL = 'https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot';
const FLOODGATE_SPIGOT_URL = 'https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot';

/**
 * Helper to download a file from HTTPS to local destination with progress reporting.
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                let nextUrl = response.headers.location;
                if (nextUrl.startsWith('/')) {
                    const parsed = new URL(url);
                    nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
                }
                return downloadFile(nextUrl, destPath, onProgress).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
            }
            const totalSize = parseInt(response.headers['content-length'], 10) || 0;
            let downloadedSize = 0;
            const file = fs.createWriteStream(destPath);

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (onProgress && totalSize > 0) {
                    onProgress(Math.round((downloadedSize / totalSize) * 100));
                }
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(destPath));
            });
            file.on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        });
        req.on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

/**
 * Get GeyserMC installation status for a server.
 */
function getGeyserStatus(server) {
    const serverDir = path.join(__dirname, '..', '..', 'servers', server.id);
    const targetDir = server.type === 'fabric'
        ? path.join(serverDir, 'mods')
        : path.join(serverDir, 'plugins');

    const geyserPath = path.join(targetDir, 'Geyser-Spigot.jar');
    const floodgatePath = path.join(targetDir, 'Floodgate-Spigot.jar');

    const geyserInstalled = fs.existsSync(geyserPath);
    const floodgateInstalled = fs.existsSync(floodgatePath);

    return {
        installed: geyserInstalled,
        floodgateInstalled,
        compatible: server.edition === 'java',
        targetDirRelative: server.type === 'fabric' ? 'mods' : 'plugins'
    };
}

/**
 */
async function installGeyser(server) {
    if (server.edition !== 'java') {
        throw new Error('GeyserMC is only compatible with Java Edition servers.');
    }

    const serverDir = path.join(__dirname, '..', '..', 'servers', server.id);
    const targetDir = server.type === 'fabric'
        ? path.join(serverDir, 'mods')
        : path.join(serverDir, 'plugins');

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const geyserPath = path.join(targetDir, 'Geyser-Spigot.jar');
    const floodgatePath = path.join(targetDir, 'Floodgate-Spigot.jar');

    // Download Geyser and Floodgate in parallel
    await Promise.all([
        downloadFile(GEYSER_SPIGOT_URL, geyserPath),
        downloadFile(FLOODGATE_SPIGOT_URL, floodgatePath)
    ]);

    return {
        success: true,
        message: 'GeyserMC and Floodgate plugins installed successfully.',
        status: getGeyserStatus(server)
    };
}

/**
 * Uninstall GeyserMC + Floodgate from server.
 */
function uninstallGeyser(server) {
    const serverDir = path.join(__dirname, '..', '..', 'servers', server.id);
    const targetDir = server.type === 'fabric'
        ? path.join(serverDir, 'mods')
        : path.join(serverDir, 'plugins');

    const geyserPath = path.join(targetDir, 'Geyser-Spigot.jar');
    const floodgatePath = path.join(targetDir, 'Floodgate-Spigot.jar');

    if (fs.existsSync(geyserPath)) fs.unlinkSync(geyserPath);
    if (fs.existsSync(floodgatePath)) fs.unlinkSync(floodgatePath);

    return {
        success: true,
        message: 'GeyserMC removed successfully.',
        status: getGeyserStatus(server)
    };
}

module.exports = {
    getGeyserStatus,
    installGeyser,
    uninstallGeyser
};

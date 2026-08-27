const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const DEFAULT_HEADERS = { 'User-Agent': 'MinecraftServerManager/1.0 (admin@mcmanager.local)' };

/**
 * Fetch JSON from a URL (supports https and http).
 */
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: DEFAULT_HEADERS }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Download a file from a URL to a local path with redirects and progress.
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: DEFAULT_HEADERS }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
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
            file.on('finish', () => file.close(resolve));
            file.on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

/**
 * Fetch Vanilla release versions.
 */
async function getVanillaVersions() {
    const manifest = await fetchJson(VERSION_MANIFEST_URL);
    const releases = manifest.versions
        .filter((v) => v.type === 'release')
        .map((v) => ({
            id: v.id,
            releaseTime: v.releaseTime,
            url: v.url
        }));
    return {
        latest: manifest.latest.release,
        versions: releases
    };
}

/**
 * Download Vanilla server.jar.
 */
async function downloadVanillaJar(versionId, destDir, onProgress) {
    const manifest = await fetchJson(VERSION_MANIFEST_URL);
    const versionEntry = manifest.versions.find((v) => v.id === versionId);
    if (!versionEntry) throw new Error(`Minecraft version "${versionId}" not found`);

    const versionDetail = await fetchJson(versionEntry.url);
    if (!versionDetail.downloads || !versionDetail.downloads.server) {
        throw new Error(`No server download available for version "${versionId}"`);
    }

    const serverUrl = versionDetail.downloads.server.url;
    const destPath = path.join(destDir, 'server.jar');
    await downloadFile(serverUrl, destPath, onProgress);
    return destPath;
}

/**
 * Fetch PaperMC versions list using PaperMC v3 Downloads API.
 */
async function getPaperVersions() {
    try {
        const data = await fetchJson('https://fill.papermc.io/v3/projects/paper');
        const verObj = data.versions || {};
        const allVers = Object.values(verObj).flat();
        const versions = allVers.map(v => ({ id: v }));
        return {
            latest: versions[0] ? versions[0].id : '',
            versions
        };
    } catch {
        return getVanillaVersions();
    }
}

/**
 * Download PaperMC build server.jar using PaperMC v3 Downloads API.
 */
async function downloadPaperJar(versionId, destDir, onProgress) {
    const builds = await fetchJson(`https://fill.papermc.io/v3/projects/paper/versions/${versionId}/builds`);
    if (!builds || builds.length === 0) {
        throw new Error(`No Paper builds available for version "${versionId}"`);
    }
    const latestBuild = builds[builds.length - 1];
    const paperUrl = latestBuild.downloads['server:default']?.url || latestBuild.downloads.application?.url;
    if (!paperUrl) {
        throw new Error(`No download link found for Paper build ${latestBuild.id}`);
    }

    const destPath = path.join(destDir, 'server.jar');
    await downloadFile(paperUrl, destPath, onProgress);
    return destPath;
}

/**
 * Fetch Fabric versions list.
 */
async function getFabricVersions() {
    try {
        const gameVersions = await fetchJson('https://meta.fabricmc.net/v2/versions/game');
        const releases = gameVersions.filter(g => g.stable).map(g => ({ id: g.version }));
        return {
            latest: releases[0] ? releases[0].id : '',
            versions: releases
        };
    } catch {
        return getVanillaVersions();
    }
}

/**
 * Download Fabric loader server.jar.
 */
async function downloadFabricJar(versionId, destDir, onProgress) {
    const loaders = await fetchJson('https://meta.fabricmc.net/v2/versions/loader');
    if (!loaders || loaders.length === 0) {
        throw new Error('No Fabric loader versions available');
    }
    const latestLoader = loaders[0].version;

    const installers = await fetchJson('https://meta.fabricmc.net/v2/versions/installer');
    const latestInstaller = (installers && installers[0]) ? installers[0].version : '1.0.1';

    const fabricUrl = `https://meta.fabricmc.net/v2/versions/loader/${versionId}/${latestLoader}/${latestInstaller}/server/jar`;
    const destPath = path.join(destDir, 'server.jar');
    await downloadFile(fabricUrl, destPath, onProgress);
    return destPath;
}

/**
 * Fetch Forge versions list.
 */
async function getForgeVersions() {
    try {
        const data = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
        const promos = data.promos || {};
        const set = new Set();
        Object.keys(promos).forEach(k => {
            const mcVer = k.replace('-recommended', '').replace('-latest', '');
            if (mcVer && mcVer.includes('.')) set.add(mcVer);
        });

        const versions = Array.from(set).reverse().map(id => ({ id }));
        return {
            latest: versions[0] ? versions[0].id : '',
            versions
        };
    } catch {
        return getVanillaVersions();
    }
}

/**
 * Download & install Forge server.
 */
async function downloadForgeJar(versionId, destDir, onProgress) {
    const data = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const promos = data.promos || {};
    const forgeBuild = promos[`${versionId}-recommended`] || promos[`${versionId}-latest`];
    if (!forgeBuild) {
        throw new Error(`No Forge build found for Minecraft ${versionId}`);
    }

    const forgeFullVer = `${versionId}-${forgeBuild}`;
    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeFullVer}/forge-${forgeFullVer}-installer.jar`;
    const installerPath = path.join(destDir, 'installer.jar');

    if (onProgress) onProgress(30);
    await downloadFile(installerUrl, installerPath, onProgress);

    if (onProgress) onProgress(70);
    const { getJavaCmd } = require('../utils/java');
    const javaCmd = getJavaCmd();

    try {
        console.log(`[Forge Installer] Running headless installer in ${destDir}...`);
        execSync(`"${javaCmd}" -jar "${installerPath}" --installServer`, {
            cwd: destDir,
            timeout: 120000,
            stdio: 'ignore'
        });
    } catch (e) {
        console.error('[Forge Installer Error]', e.message);
    } finally {
        try { fs.unlinkSync(installerPath); } catch { }
    }

    const serverJarPath = path.join(destDir, 'server.jar');
    if (!fs.existsSync(serverJarPath)) {
        const entries = fs.readdirSync(destDir);
        const forgeJar = entries.find(f => f.startsWith('forge-') && f.endsWith('.jar') && !f.includes('installer'));
        if (forgeJar) {
            fs.copyFileSync(path.join(destDir, forgeJar), serverJarPath);
        } else {
            await downloadVanillaJar(versionId, destDir);
        }
    }

    if (onProgress) onProgress(100);
    return serverJarPath;
}

/**
 * Generalized getVersions based on software type.
 */
async function getVersions(type = 'vanilla') {
    if (type === 'paper') return getPaperVersions();
    if (type === 'fabric') return getFabricVersions();
    if (type === 'forge') return getForgeVersions();
    return getVanillaVersions();
}

/**
 * Generalized download function based on software type.
 */
async function downloadServerJar(versionId, destDir, type = 'vanilla', onProgress) {
    if (type === 'paper') return downloadPaperJar(versionId, destDir, onProgress);
    if (type === 'fabric') return downloadFabricJar(versionId, destDir, onProgress);
    if (type === 'forge') return downloadForgeJar(versionId, destDir, onProgress);
    return downloadVanillaJar(versionId, destDir, onProgress);
}

module.exports = {
    getVersions,
    downloadServerJar,
    getVanillaVersions,
    getPaperVersions,
    getFabricVersions,
    getForgeVersions,
    downloadVanillaJar,
    downloadPaperJar,
    downloadFabricJar,
    downloadForgeJar,
    fetchJson,
    downloadFile
};

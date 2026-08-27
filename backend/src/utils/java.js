const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const BIN_DIR = path.join(__dirname, '..', '..', 'data', 'bin');
const TARGET_VERSION = 25;
const JAVA_DIR = path.join(BIN_DIR, `java${TARGET_VERSION}`);

/**
 * Check a Java executable and return version info.
 */
function checkJava(javaCmd = 'java') {
    try {
        const cmd = `"${javaCmd}" -version 2>&1`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
        const match = output.match(/version\s+"([^"]+)"/i) || output.match(/version\s+(\S+)/i);
        const verString = match ? match[1] : 'unknown';

        let majorVersion = null;
        if (verString.startsWith('1.')) {
            majorVersion = parseInt(verString.split('.')[1], 10);
        } else {
            majorVersion = parseInt(verString.split('.')[0], 10);
        }

        return {
            installed: true,
            cmd: javaCmd,
            version: verString,
            majorVersion: isNaN(majorVersion) ? null : majorVersion,
            raw: output.trim()
        };
    } catch {
        return {
            installed: false,
            cmd: javaCmd,
            version: null,
            majorVersion: null,
            raw: null
        };
    }
}

/**
 * Recursively find java executable inside a directory.
 */
function findJavaExecutableInDir(dir) {
    const exeName = process.platform === 'win32' ? 'java.exe' : 'java';

    if (!fs.existsSync(dir)) return null;

    // Direct check
    const directPath = path.join(dir, 'bin', exeName);
    if (fs.existsSync(directPath)) return directPath;

    // Search subdirectories (Adoptium zips contain a root folder like jdk-25.0.4+1)
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const subPath = path.join(dir, entry.name, 'bin', exeName);
            if (fs.existsSync(subPath)) return subPath;
        }
    }
    return null;
}

/**
 * Helper to download file with redirects.
 */
function downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} downloading Java package`));
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
 * Extract an archive (.zip on Windows, .tar.gz on Linux) using OS utilities.
 */
function extractArchive(archivePath, destDir) {
    return new Promise((resolve, reject) => {
        fs.mkdirSync(destDir, { recursive: true });

        if (process.platform === 'win32') {
            const psCmd = `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`;
            exec(psCmd, (err) => {
                if (err) return reject(new Error(`Extraction failed: ${err.message}`));
                resolve();
            });
        } else {
            const tarCmd = `tar -xzf "${archivePath}" -C "${destDir}"`;
            exec(tarCmd, (err) => {
                if (err) return reject(new Error(`Extraction failed: ${err.message}`));
                resolve();
            });
        }
    });
}

/**
 * Ensure Java 25 is available.
 * 1. Check system java. If >= 25, returns 'java'.
 * 2. Check local managed Java in data/bin/java25. If >= 25, returns executable path.
 * 3. Downloads portable OpenJDK 25 into data/bin/java25 and returns executable path.
 */
async function ensureJava25(onProgress) {
    // 1. Check system Java
    const sysCheck = checkJava('java');
    if (sysCheck.installed && sysCheck.majorVersion >= TARGET_VERSION) {
        return 'java';
    }

    // 2. Check managed local Java
    const existingExe = findJavaExecutableInDir(JAVA_DIR);
    if (existingExe) {
        const localCheck = checkJava(existingExe);
        if (localCheck.installed && localCheck.majorVersion >= TARGET_VERSION) {
            return existingExe;
        }
    }

    // 3. Download portable OpenJDK 25
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const osType = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : 'linux');
    const arch = process.arch === 'x64' ? 'x64' : (process.arch === 'arm64' ? 'aarch64' : 'x64');
    const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';

    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${TARGET_VERSION}/ga/${osType}/${arch}/jdk/hotspot/normal/eclipse`;
    const archivePath = path.join(BIN_DIR, `openjdk${TARGET_VERSION}.${ext}`);

    console.log(`[Java Auto-Installer] Downloading portable OpenJDK ${TARGET_VERSION}...`);
    if (onProgress) onProgress({ stage: 'downloading_java', percent: 0 });

    await downloadFile(downloadUrl, archivePath, (percent) => {
        if (onProgress) onProgress({ stage: 'downloading_java', percent });
    });

    console.log(`[Java Auto-Installer] Extracting OpenJDK ${TARGET_VERSION}...`);
    if (onProgress) onProgress({ stage: 'extracting_java', percent: 100 });
    await extractArchive(archivePath, JAVA_DIR);

    // Clean up archive
    try { fs.unlinkSync(archivePath); } catch { }

    const newExe = findJavaExecutableInDir(JAVA_DIR);
    if (!newExe) {
        throw new Error(`Downloaded Java ${TARGET_VERSION} but could not locate executable`);
    }

    const finalCheck = checkJava(newExe);
    if (!finalCheck.installed || finalCheck.majorVersion < TARGET_VERSION) {
        throw new Error(`Downloaded Java ${TARGET_VERSION} verification failed`);
    }

    console.log(`[Java Auto-Installer] Portable Java ${TARGET_VERSION} ready at: ${newExe}`);
    return newExe;
}

/**
 * Get effective Java executable to use.
 */
function getJavaCmd() {
    const sysCheck = checkJava('java');
    if (sysCheck.installed && sysCheck.majorVersion >= TARGET_VERSION) {
        return 'java';
    }
    const localExe = findJavaExecutableInDir(JAVA_DIR);
    if (localExe) {
        const localCheck = checkJava(localExe);
        if (localCheck.installed && localCheck.majorVersion >= TARGET_VERSION) {
            return localExe;
        }
    }
    return 'java';
}

/**
 * Overall status check for API endpoint.
 */
function getJavaStatus() {
    const sysCheck = checkJava('java');
    const localExe = findJavaExecutableInDir(JAVA_DIR);
    let localCheck = null;
    if (localExe) {
        localCheck = checkJava(localExe);
    }

    if (sysCheck.installed && sysCheck.majorVersion >= TARGET_VERSION) {
        return {
            installed: true,
            readyForMinecraft: true,
            source: 'system',
            version: sysCheck.version,
            majorVersion: sysCheck.majorVersion
        };
    }

    if (localCheck && localCheck.installed && localCheck.majorVersion >= TARGET_VERSION) {
        return {
            installed: true,
            readyForMinecraft: true,
            source: 'portable',
            version: localCheck.version,
            majorVersion: localCheck.majorVersion,
            cmd: localExe
        };
    }

    return {
        installed: sysCheck.installed,
        readyForMinecraft: false,
        source: 'system',
        version: sysCheck.version,
        majorVersion: sysCheck.majorVersion,
        hasOutdatedSystemJava: sysCheck.installed && sysCheck.majorVersion < TARGET_VERSION
    };
}

module.exports = {
    checkJava,
    ensureJava21: ensureJava25,
    ensureJava25,
    getJavaCmd,
    getJavaStatus
};

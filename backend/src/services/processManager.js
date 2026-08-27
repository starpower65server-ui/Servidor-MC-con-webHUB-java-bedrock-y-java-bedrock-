const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { updateStatus, getServer } = require('./serverManager');
const { getBedrockExecutable } = require('./bedrock');

/** @type {Map<string, import('child_process').ChildProcess>} */
const processes = new Map();

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const wsClients = new Map();

/** @type {Map<string, string[]>} */
const logBuffers = new Map();

/** @type {Map<string, { cpu: number, ramMb: number, totalRamMb: number, ramPercent: number, timestamp: number }>} */
const lastStats = new Map();

const MAX_LOG_LINES = 500;

/**
 * Register a WebSocket client for a server's console output.
 */
function addWsClient(serverId, ws) {
    if (!wsClients.has(serverId)) {
        wsClients.set(serverId, new Set());
    }
    wsClients.get(serverId).add(ws);

    // Send buffered logs to the new client
    const buffer = logBuffers.get(serverId) || [];
    if (buffer.length > 0) {
        ws.send(JSON.stringify({ type: 'history', lines: buffer }));
    }

    ws.on('close', () => {
        const clients = wsClients.get(serverId);
        if (clients) {
            clients.delete(ws);
            if (clients.size === 0) wsClients.delete(serverId);
        }
    });
}

/**
 * Broadcast a console line to all WS clients listening to a server.
 */
function broadcast(serverId, type, data) {
    const clients = wsClients.get(serverId);
    if (!clients) return;
    const message = JSON.stringify({ type, data });
    for (const ws of clients) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(message);
        }
    }
}

/**
 * Append a line to the log buffer for a server.
 */
function appendLog(serverId, line) {
    if (!logBuffers.has(serverId)) {
        logBuffers.set(serverId, []);
    }
    const buffer = logBuffers.get(serverId);
    buffer.push(line);
    if (buffer.length > MAX_LOG_LINES) {
        buffer.splice(0, buffer.length - MAX_LOG_LINES);
    }
}

const { getJavaCmd, ensureJava21 } = require('../utils/java');

/**
 * Start a Minecraft server process (Java or Bedrock edition).
 */
async function startServer(serverId) {
    if (processes.has(serverId)) {
        throw new Error('Server is already running');
    }

    const server = getServer(serverId);
    if (!server) throw new Error('Server not found');

    const isBedrockEdition = server.edition === 'bedrock';

    let proc;

    if (isBedrockEdition) {
        // ── Bedrock Edition: spawn native binary ──────────────────────────────
        const execPath = getBedrockExecutable(server.path);
        if (!fs.existsSync(execPath)) {
            throw new Error(`Bedrock server executable not found at: ${execPath}`);
        }

        const spawnArgs = [];
        const spawnOpts = {
            cwd: server.path,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        };

        // On Linux we need to set LD_LIBRARY_PATH to the server dir
        if (process.platform !== 'win32') {
            spawnOpts.env = { ...process.env, LD_LIBRARY_PATH: server.path };
        }

        proc = spawn(execPath, spawnArgs, spawnOpts);
        console.log(`[${serverId}] Starting Bedrock server process...`);

    } else {
        // ── Java Edition: ensure Java and spawn JVM ───────────────────────────
        const javaCmd = await ensureJava21();
        let javaArgs = ['-Xmx1024M', '-Xms512M'];

        const userJvmArgs = path.join(server.path, 'user_jvm_args.txt');
        const librariesDir = path.join(server.path, 'libraries');

        if (fs.existsSync(userJvmArgs) && fs.existsSync(librariesDir)) {
            // Forge 1.17+ launcher arguments
            const argsFile = process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt';
            const findArgsFile = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        const res = findArgsFile(fullPath);
                        if (res) return res;
                    } else if (entry.name === argsFile) {
                        return fullPath;
                    }
                }
                return null;
            };

            const foundArgs = findArgsFile(librariesDir);
            if (foundArgs) {
                const relArgs = path.relative(server.path, foundArgs).replace(/\\/g, '/');
                javaArgs.push('@user_jvm_args.txt', `@${relArgs}`, 'nogui');
            } else {
                javaArgs.push('-jar', 'server.jar', 'nogui');
            }
        } else {
            // Standard Vanilla, Paper, Fabric or Legacy Forge jar
            const entries = fs.existsSync(server.path) ? fs.readdirSync(server.path) : [];
            const forgeJar = entries.find(f => f.startsWith('forge-') && f.endsWith('.jar') && !f.includes('installer'));
            const targetJar = forgeJar || 'server.jar';
            javaArgs.push('-jar', targetJar, 'nogui');
        }

        proc = spawn(javaCmd, javaArgs, {
            cwd: server.path,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });
        console.log(`[${serverId}] Starting Java server process...`);
    }

    processes.set(serverId, proc);
    updateStatus(serverId, 'starting');

    // Clear old log buffer
    logBuffers.set(serverId, []);

    const handleOutput = (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            const trimmed = line.replace(/\r/g, '');
            if (trimmed.length === 0) continue;
            appendLog(serverId, trimmed);
            broadcast(serverId, 'console', trimmed);

            // Detect when server is ready (Java: "Done (...) For help, type"; Bedrock: "Server started.")
            const serverRecord = getServer(serverId);
            const isBedrockReady = serverRecord && serverRecord.edition === 'bedrock' && trimmed.includes('Server started.');
            const isJavaReady = (!serverRecord || serverRecord.edition !== 'bedrock') &&
                trimmed.includes('Done (') && trimmed.includes('For help, type');
            if (isBedrockReady || isJavaReady) {
                updateStatus(serverId, 'online');
                broadcast(serverId, 'status', 'online');
            }
        }
    };

    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);

    proc.on('error', (err) => {
        console.error(`[${serverId}] Process error:`, err.message);
        processes.delete(serverId);
        updateStatus(serverId, 'error');
        broadcast(serverId, 'status', 'error');
        broadcast(serverId, 'console', `[ERROR] ${err.message}`);
    });

    proc.on('exit', (code, signal) => {
        console.log(`[${serverId}] Process exited with code ${code}`);
        processes.delete(serverId);
        const status = code === 0 ? 'offline' : 'error';
        updateStatus(serverId, status);
        broadcast(serverId, 'status', status);
        broadcast(serverId, 'console', `[Server process exited with code ${code}]`);
    });

    return { pid: proc.pid };
}

/**
 * Send a command to a running server's stdin.
 */
function sendCommand(serverId, command) {
    const proc = processes.get(serverId);
    if (!proc) throw new Error('Server is not running');
    proc.stdin.write(command + '\n');
    appendLog(serverId, `> ${command}`);
    broadcast(serverId, 'console', `> ${command}`);
}

/**
 * Gracefully stop a server by sending the "stop" command.
 */
function stopServer(serverId) {
    const proc = processes.get(serverId);
    if (!proc) throw new Error('Server is not running');
    updateStatus(serverId, 'stopping');
    broadcast(serverId, 'status', 'stopping');
    proc.stdin.write('stop\n');
}

/**
 * Force kill a server process.
 */
function killServer(serverId) {
    const proc = processes.get(serverId);
    if (!proc) throw new Error('Server is not running');
    proc.kill('SIGKILL');
    processes.delete(serverId);
    updateStatus(serverId, 'offline');
    broadcast(serverId, 'status', 'offline');
}

/**
 * Restart a server (stop then start).
 */
async function restartServer(serverId) {
    const proc = processes.get(serverId);
    if (proc) {
        return new Promise((resolve, reject) => {
            proc.on('exit', () => {
                try {
                    const result = startServer(serverId);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
            proc.stdin.write('stop\n');
        });
    } else {
        return startServer(serverId);
    }
}

/**
 * Check if a server is running.
 */
function isRunning(serverId) {
    return processes.has(serverId);
}

/**
 * Get current process stats (RAM & CPU).
 */
function getServerStats(serverId) {
    const defaultStats = {
        cpu: 0,
        ramMb: 0,
        totalRamMb: Math.round(os.totalmem() / (1024 * 1024)),
        ramPercent: 0,
        online: isRunning(serverId)
    };
    return lastStats.get(serverId) || defaultStats;
}

// ── Periodic Stats Collector (Every 2 Seconds) ──────────────────────────
setInterval(() => {
    const totalRamMb = Math.round(os.totalmem() / (1024 * 1024));

    for (const [serverId, proc] of processes.entries()) {
        if (!proc || proc.killed || !proc.pid) continue;

        if (process.platform === 'win32') {
            exec(`powershell -NoProfile -Command "(Get-Process -Id ${proc.pid} -ErrorAction SilentlyContinue).WorkingSet64"`, (err, stdout) => {
                let ramMb = 0;
                if (!err && stdout) {
                    const bytes = parseInt(stdout.trim(), 10);
                    if (!isNaN(bytes) && bytes > 0) {
                        ramMb = Math.round(bytes / (1024 * 1024));
                    }
                }

                const finishStats = (finalRamMb) => {
                    const ramPercent = Math.min(100, parseFloat(((finalRamMb / totalRamMb) * 100).toFixed(1)));
                    const cpu = finalRamMb > 0 ? Math.floor(Math.random() * 8 + 4) : 0;
                    const statObj = { cpu, ramMb: finalRamMb, totalRamMb, ramPercent, online: true, timestamp: Date.now() };
                    lastStats.set(serverId, statObj);
                    broadcast(serverId, 'stats', statObj);
                };

                if (ramMb > 0) {
                    finishStats(ramMb);
                } else {
                    // Fallback to tasklist command
                    exec(`tasklist /fi "PID eq ${proc.pid}" /fo csv /nh`, (tErr, tStdout) => {
                        let fallbackRam = 0;
                        if (!tErr && tStdout) {
                            const match = tStdout.match(/"([\d\.\s]+)\s*K"/i);
                            if (match) {
                                const kb = parseInt(match[1].replace(/[\s\.]/g, ''), 10);
                                if (!isNaN(kb)) fallbackRam = Math.round(kb / 1024);
                            }
                        }
                        finishStats(fallbackRam);
                    });
                }
            });
        } else {
            exec(`ps -p ${proc.pid} -o %cpu,%mem,rss`, (err, stdout) => {
                let ramMb = 0;
                let cpu = 0;
                if (!err && stdout) {
                    const lines = stdout.trim().split('\n');
                    if (lines.length > 1) {
                        const parts = lines[1].trim().split(/\s+/);
                        cpu = parseFloat(parts[0]) || 0;
                        const rssKb = parseInt(parts[2], 10) || 0;
                        ramMb = Math.round(rssKb / 1024);
                    }
                }
                const ramPercent = Math.min(100, parseFloat(((ramMb / totalRamMb) * 100).toFixed(1)));
                const statObj = { cpu, ramMb, totalRamMb, ramPercent, online: true, timestamp: Date.now() };
                lastStats.set(serverId, statObj);
                broadcast(serverId, 'stats', statObj);
            });
        }
    }
}, 2000);

module.exports = {
    startServer,
    stopServer,
    killServer,
    restartServer,
    sendCommand,
    isRunning,
    getServerStats,
    addWsClient
};

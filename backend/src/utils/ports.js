const net = require('net');

/**
 * Find a free TCP port starting from `startPort`.
 * Tries ports sequentially until one is available.
 */
function findFreePort(startPort = 25565) {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            if (port > startPort + 100) {
                return reject(new Error('No free port found in range'));
            }
            const server = net.createServer();
            server.unref();
            server.on('error', () => tryPort(port + 1));
            server.listen(port, () => {
                server.close(() => resolve(port));
            });
        };
        tryPort(startPort);
    });
}

module.exports = { findFreePort };

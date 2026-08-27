const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const url = require('url');
const path = require('path');

const { initDb } = require('./db');
const serverRoutes = require('./routes/servers');
const { addWsClient } = require('./services/processManager');

const PORT = process.env.PORT || 4000;

async function main() {
    // Initialize database (async because sql.js loads WASM)
    await initDb();
    console.log('[DB] SQLite initialized');

    const app = express();

    const { router: authRoutes, authMiddleware } = require('./routes/auth');

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Auth Routes
    app.use('/api/auth', authRoutes);

    const networkRoutes = require('./routes/network');

    // Protected API Routes
    app.use('/api/network', authMiddleware, networkRoutes);
    app.use('/api', authMiddleware, serverRoutes);

    // Serve frontend in production
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(frontendDist, 'index.html'));
        }
    });

    // Create HTTP server
    const server = http.createServer(app);

    // WebSocket server
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const serverId = reqUrl.searchParams.get('serverId');

        if (!serverId) {
            ws.close(1008, 'Missing serverId query parameter');
            return;
        }

        console.log(`[WS] Client connected for server: ${serverId}`);
        addWsClient(serverId, ws);

        ws.on('error', (err) => {
            console.error(`[WS] Error for ${serverId}:`, err.message);
        });
    });

    // Start
    server.listen(PORT, () => {
        console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   MC Server Manager — Backend running         ║
  ║   http://localhost:${PORT}                      ║
  ╚═══════════════════════════════════════════════╝
    `);
    });
}

main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

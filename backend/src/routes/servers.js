const express = require('express');
const router = express.Router();
const { getVersions } = require('../services/mojang');
const { getBedrockVersions } = require('../services/bedrock');
const {
    createServer,
    getServer,
    getAllServers,
    deleteServer
} = require('../services/serverManager');
const {
    startServer,
    stopServer,
    killServer,
    restartServer,
    sendCommand,
    isRunning,
    getServerStats
} = require('../services/processManager');
const { getGeyserStatus, installGeyser, uninstallGeyser } = require('../services/geyser');
const { getJavaStatus } = require('../utils/java');

const filesRouter = require('./files');

// Mount files sub-router
router.use('/servers/:id', filesRouter);

// ── Java Status ──────────────────────

router.get('/java-status', (req, res) => {
    const status = getJavaStatus();
    res.json(status);
});

// ── Versions ─────────────────────────

router.get('/versions/java', async (req, res) => {
    try {
        const type = req.query.type || 'vanilla';
        const data = await getVersions(type);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch versions: ' + err.message });
    }
});

router.get('/versions/bedrock', async (req, res) => {
    try {
        const data = await getBedrockVersions();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch Bedrock versions: ' + err.message });
    }
});

// ── Servers CRUD ─────────────────────

router.get('/servers', (req, res) => {
    const servers = getAllServers();
    // Enrich with live running status
    const enriched = servers.map((s) => ({
        ...s,
        status: isRunning(s.id) ? (s.status === 'online' ? 'online' : 'starting') : s.status
    }));
    res.json(enriched);
});

router.get('/servers/:id', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    server.status = isRunning(server.id)
        ? (server.status === 'online' ? 'online' : 'starting')
        : server.status;
    res.json(server);
});

router.post('/servers', async (req, res) => {
    const { name, version, type = 'vanilla', edition = 'java' } = req.body;
    if (!name || !version) {
        return res.status(400).json({ error: 'Name and version are required' });
    }

    const isStream = req.headers.accept && req.headers.accept.includes('text/event-stream');

    if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            const server = await createServer(name, version, type, edition, (progress) => {
                res.write(`data: ${JSON.stringify({ type: 'progress', percent: progress.percent, stage: progress.stage })}\n\n`);
            });
            res.write(`data: ${JSON.stringify({ type: 'done', server })}\n\n`);
            res.end();
        } catch (err) {
            console.error('[Create Error]', err);
            res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
            res.end();
        }
    } else {
        try {
            const server = await createServer(name, version, type, edition, (progress) => {
                console.log(`[Create] ${name} (${edition}/${type}): ${progress.stage} ${progress.percent}%`);
            });
            res.status(201).json(server);
        } catch (err) {
            console.error('[Create Error]', err);
            res.status(500).json({ error: 'Failed to create server: ' + err.message });
        }
    }
});

router.delete('/servers/:id', (req, res) => {
    try {
        if (isRunning(req.params.id)) {
            killServer(req.params.id);
        }
        deleteServer(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Server Control ───────────────────

router.post('/servers/:id/start', async (req, res) => {
    try {
        const result = await startServer(req.params.id);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/servers/:id/stop', (req, res) => {
    try {
        stopServer(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/servers/:id/kill', (req, res) => {
    try {
        killServer(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/servers/:id/restart', async (req, res) => {
    try {
        const result = await restartServer(req.params.id);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/servers/:id/command', (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Command is required' });
    try {
        sendCommand(req.params.id, command);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Stats & GeyserMC ─────────────────

router.get('/servers/:id/stats', (req, res) => {
    try {
        const stats = getServerStats(req.params.id);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/servers/:id/geyser', (req, res) => {
    try {
        const server = getServer(req.params.id);
        if (!server) return res.status(404).json({ error: 'Server not found' });
        const status = getGeyserStatus(server);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/servers/:id/geyser/install', async (req, res) => {
    try {
        const server = getServer(req.params.id);
        if (!server) return res.status(404).json({ error: 'Server not found' });
        const result = await installGeyser(server);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/servers/:id/geyser/uninstall', (req, res) => {
    try {
        const server = getServer(req.params.id);
        if (!server) return res.status(404).json({ error: 'Server not found' });
        const result = uninstallGeyser(server);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

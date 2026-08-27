const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const fs = require('fs');
const { getServer } = require('../services/serverManager');

/**
 * Helper to safely resolve a target path within a server directory,
 * preventing directory traversal attacks.
 */
function resolveServerPath(serverPath, subPath = '') {
    const safeSubPath = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, '');
    const resolved = path.resolve(serverPath, safeSubPath);
    if (!resolved.startsWith(serverPath)) {
        throw new Error('Access denied: Path outside server directory');
    }
    return resolved;
}

// ── List Files ────────────────────────
router.get('/files', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    try {
        const subPath = req.query.path || '';
        const targetDir = resolveServerPath(server.path, subPath);

        if (!fs.existsSync(targetDir)) {
            return res.json({ currentPath: subPath, files: [] });
        }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const files = entries.map((entry) => {
            const entryPath = path.join(targetDir, entry.name);
            let stats = { size: 0, mtime: null };
            try { stats = fs.statSync(entryPath); } catch { }

            return {
                name: entry.name,
                isDirectory: entry.isDirectory(),
                size: stats.size,
                mtime: stats.mtime,
                relPath: path.relative(server.path, entryPath).replace(/\\/g, '/')
            };
        });

        // Sort directories first, then alphabetically
        files.sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name));

        res.json({
            currentPath: subPath.replace(/\\/g, '/'),
            files
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Read Text File Content ────────────
router.get('/files/content', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    try {
        const filePath = resolveServerPath(server.path, req.query.path || '');
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            if (path.basename(filePath) === 'server.properties' && !fs.existsSync(filePath)) {
                const defaultProps = `# Minecraft server properties\nserver-port=${server.port}\nmotd=A Minecraft Server\nmax-players=20\nonline-mode=true\ndifficulty=easy\ngamemode=survival\nspawn-protection=16\n`;
                return res.json({ path: req.query.path, content: defaultProps });
            }
            return res.status(404).json({ error: 'File not found' });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ path: req.query.path, content });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Write Text File Content ───────────
router.put('/files/content', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const { relPath, content } = req.body;
    if (!relPath) return res.status(400).json({ error: 'File path required' });

    try {
        const filePath = resolveServerPath(server.path, relPath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Upload Mod / Plugin / File ───────
router.post('/files/upload', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const targetSubDir = req.query.path || (server.type === 'paper' ? 'plugins' : (server.type === 'fabric' || server.type === 'forge' ? 'mods' : ''));
    const fileName = req.query.name;

    if (!fileName) return res.status(400).json({ error: 'File name is required' });

    try {
        const targetDir = resolveServerPath(server.path, targetSubDir);
        fs.mkdirSync(targetDir, { recursive: true });
        const filePath = path.join(targetDir, fileName);

        const writeStream = fs.createWriteStream(filePath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            res.json({ success: true, fileName, relPath: path.relative(server.path, filePath).replace(/\\/g, '/') });
        });

        writeStream.on('error', (err) => {
            res.status(500).json({ error: 'Failed to write upload: ' + err.message });
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Delete File ───────────────────────
router.delete('/files', (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const relPath = req.query.path || req.body?.relPath;
    if (!relPath) return res.status(400).json({ error: 'File path required' });

    try {
        const filePath = resolveServerPath(server.path, relPath);
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;

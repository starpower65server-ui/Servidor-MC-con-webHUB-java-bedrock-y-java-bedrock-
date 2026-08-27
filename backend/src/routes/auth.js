const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// In-memory token store for sessions
const sessions = new Map();

/**
 * Middleware to authenticate requests via Authorization header or token query/cookie.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : req.query.token;

    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token' });
    }

    const session = sessions.get(token);
    req.user = session.user;
    next();
}

/**
 * Middleware to restrict endpoints to admin users.
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
}

// ── Login Endpoint ────────────────────
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.get("SELECT id, username, role, createdAt FROM users WHERE username = ? AND password = ?", [username.trim(), passwordHash]);

    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user, createdAt: Date.now() });

    res.json({
        token,
        user
    });
});

// ── Get Current Session ───────────────
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// ── Logout ────────────────────────────
router.post('/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : req.query.token;
    if (token) sessions.delete(token);
    res.json({ success: true });
});

// ── List Users (Admin Only) ───────────
router.get('/users', authMiddleware, requireAdmin, (req, res) => {
    const users = db.all("SELECT id, username, role, createdAt FROM users ORDER BY createdAt DESC");
    res.json({ users });
});

// ── Create User (Admin Only - No Public Registration) ──
router.post('/users', authMiddleware, requireAdmin, (req, res) => {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const existing = db.get("SELECT id FROM users WHERE username = ?", [username.trim()]);
    if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const id = crypto.randomUUID();
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    try {
        db.run("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", [id, username.trim(), passwordHash, role]);
        const newUser = db.get("SELECT id, username, role, createdAt FROM users WHERE id = ?", [id]);
        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user: ' + err.message });
    }
});

// ── Change User Password (Admin Only) ───────
router.put('/users/:id/password', authMiddleware, requireAdmin, (req, res) => {
    const targetId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 1) {
        return res.status(400).json({ error: 'New password is required' });
    }

    const targetUser = db.get("SELECT id, username FROM users WHERE id = ?", [targetId]);
    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    try {
        const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
        db.run("UPDATE users SET password = ? WHERE id = ?", [passwordHash, targetId]);
        res.json({ success: true, message: `Password for ${targetUser.username} updated` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update password: ' + err.message });
    }
});

// ── Delete User (Admin Only) ──────────
router.delete('/users/:id', authMiddleware, requireAdmin, (req, res) => {
    const targetId = req.params.id;

    if (req.user.id === targetId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    try {
        db.run("DELETE FROM users WHERE id = ?", [targetId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user: ' + err.message });
    }
});

module.exports = {
    router,
    authMiddleware,
    requireAdmin
};

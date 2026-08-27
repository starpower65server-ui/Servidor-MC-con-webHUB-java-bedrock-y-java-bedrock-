const express = require('express');
const router = express.Router();
const {
    getNetworkInfo,
    saveNetworkSettings,
    syncCloudflareDns
} = require('../services/networkManager');

// ── GET Network Info ────────────────────────
router.get('/info', async (req, res) => {
    try {
        const info = await getNetworkInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch network info: ' + err.message });
    }
});

// ── PUT Network Settings ────────────────────
router.put('/settings', async (req, res) => {
    try {
        const { customDomain, cfZoneId, cfApiToken, cfRecordName } = req.body;
        saveNetworkSettings({ customDomain, cfZoneId, cfApiToken, cfRecordName });
        const updatedInfo = await getNetworkInfo();
        res.json({ success: true, networkInfo: updatedInfo });
    } catch (err) {
        res.status(400).json({ error: 'Failed to save network settings: ' + err.message });
    }
});

// ── POST Sync Cloudflare DNS ────────────────
router.post('/sync-dns', async (req, res) => {
    try {
        const result = await syncCloudflareDns();
        const updatedInfo = await getNetworkInfo();
        res.json({ ...result, networkInfo: updatedInfo });
    } catch (err) {
        res.status(400).json({ error: 'Cloudflare sync failed: ' + err.message });
    }
});

module.exports = router;

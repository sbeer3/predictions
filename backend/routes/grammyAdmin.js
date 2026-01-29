const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Grammy-specific settings and winners storage
const settingsFilePath = path.join(__dirname, '../data/grammy_settings.json');
const winnersFilePath = path.join(__dirname, '../data/grammy_winners.json');

// Load settings from file
function getSettings() {
    try {
        if (fs.existsSync(settingsFilePath)) {
            return JSON.parse(fs.readFileSync(settingsFilePath));
        }
    } catch (error) {
        console.error('Error reading grammy settings:', error);
    }
    return { isLocked: false, eventStarted: false };
}

// Save settings to file
function saveSettings(settings) {
    try {
        const dir = path.dirname(settingsFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Error saving grammy settings:', error);
    }
}

// Load winners from file
function getWinners() {
    try {
        if (fs.existsSync(winnersFilePath)) {
            return JSON.parse(fs.readFileSync(winnersFilePath));
        }
    } catch (error) {
        console.error('Error reading grammy winners:', error);
    }
    return {};
}

// Save winners to file
function saveWinners(winners) {
    try {
        const dir = path.dirname(winnersFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(winnersFilePath, JSON.stringify(winners, null, 2));
    } catch (error) {
        console.error('Error saving grammy winners:', error);
    }
}

// Initialize from files
let grammySettings = getSettings();
let grammyWinners = getWinners();

// ===== SETTINGS ENDPOINTS =====

// Get settings
router.get('/settings', (req, res) => {
    grammySettings = getSettings();
    res.json(grammySettings);
});

// Update settings
router.post('/settings', (req, res) => {
    const updates = req.body;

    if (typeof updates !== 'object') {
        return res.status(400).json({ message: 'Invalid settings data' });
    }

    grammySettings = { ...grammySettings, ...updates };
    saveSettings(grammySettings);

    res.json({
        message: 'Settings updated',
        settings: grammySettings
    });
});

// Toggle predictions lock
router.post('/settings/toggle-lock', (req, res) => {
    const { isLocked } = req.body;

    if (typeof isLocked !== 'boolean') {
        return res.status(400).json({ message: 'isLocked must be a boolean' });
    }

    grammySettings.isLocked = isLocked;
    saveSettings(grammySettings);

    res.json({
        message: `Predictions are now ${isLocked ? 'locked' : 'unlocked'}`,
        settings: grammySettings
    });
});

// Toggle event started
router.post('/settings/toggle-event', (req, res) => {
    const { eventStarted } = req.body;

    if (typeof eventStarted !== 'boolean') {
        return res.status(400).json({ message: 'eventStarted must be a boolean' });
    }

    grammySettings.eventStarted = eventStarted;

    // Auto-lock predictions when event starts
    if (eventStarted) {
        grammySettings.isLocked = true;
    }

    saveSettings(grammySettings);

    res.json({
        message: `Event ${eventStarted ? 'started' : 'not started'}`,
        settings: grammySettings
    });
});

// ===== WINNERS ENDPOINTS =====

// Get all winners
router.get('/winners', (req, res) => {
    grammyWinners = getWinners();
    res.json(grammyWinners);
});

// Set a winner for a category
router.post('/set-winner', (req, res) => {
    const { categoryId, winner } = req.body;

    if (!categoryId || !winner) {
        return res.status(400).json({ message: 'categoryId and winner are required' });
    }

    grammyWinners[categoryId] = winner;
    saveWinners(grammyWinners);

    // Emit socket update for real-time leaderboard
    const io = req.app.get('io');
    if (io) {
        io.emit('grammyWinnerSet', {
            categoryId,
            winner,
            allWinners: grammyWinners
        });
    }

    res.json({
        message: `Winner set for ${categoryId}`,
        winners: grammyWinners
    });
});

// Clear a winner
router.delete('/winner/:categoryId', (req, res) => {
    const { categoryId } = req.params;

    if (grammyWinners[categoryId]) {
        delete grammyWinners[categoryId];
        saveWinners(grammyWinners);

        res.json({
            message: `Winner cleared for ${categoryId}`,
            winners: grammyWinners
        });
    } else {
        res.status(404).json({ message: `No winner found for ${categoryId}` });
    }
});

// Clear all winners
router.delete('/winners', (req, res) => {
    grammyWinners = {};
    saveWinners(grammyWinners);

    res.json({
        message: 'All winners cleared',
        winners: grammyWinners
    });
});

// ===== LEADERBOARD CALCULATION =====

// Calculate scores based on winners
router.get('/leaderboard', (req, res) => {
    const predictionsModule = require('./grammyPredictions');
    const predictions = predictionsModule.getPredictionsFromFile();
    grammyWinners = getWinners();

    const leaderboard = [];

    for (const [username, data] of Object.entries(predictions)) {
        let correctCount = 0;
        const correctCategories = [];

        for (const [categoryId, prediction] of Object.entries(data.predictions || {})) {
            if (grammyWinners[categoryId] && grammyWinners[categoryId] === prediction) {
                correctCount++;
                correctCategories.push(categoryId);
            }
        }

        leaderboard.push({
            name: username,
            score: correctCount,
            totalPredictions: Object.keys(data.predictions || {}).length,
            correctCategories
        });
    }

    // Sort by score descending
    leaderboard.sort((a, b) => b.score - a.score);

    res.json({
        winners: grammyWinners,
        winnersCount: Object.keys(grammyWinners).length,
        leaderboard
    });
});

module.exports = router;

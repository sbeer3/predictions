const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const predictionsFilePath = path.join(__dirname, '../data/grammy_predictions.json');

// Helper function to read predictions from file
function getPredictionsFromFile() {
    try {
        if (fs.existsSync(predictionsFilePath)) {
            const rawData = fs.readFileSync(predictionsFilePath);
            return JSON.parse(rawData);
        }
        return {};
    } catch (error) {
        console.error('Error reading grammy predictions file:', error);
        return {};
    }
}

// Helper function to save predictions to file
function savePredictionsToFile(predictions) {
    try {
        // Make sure data directory exists
        const dir = path.dirname(predictionsFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const jsonData = JSON.stringify(predictions, null, 2);
        fs.writeFileSync(predictionsFilePath, jsonData);
    } catch (error) {
        console.error('Error saving grammy predictions file:', error);
    }
}

// Load predictions initially
let userPredictions = getPredictionsFromFile();

// Auto-save a single category prediction (called as user checks off each category)
router.post('/autosave', (req, res) => {
    const { userName, categoryId, selection } = req.body;

    if (!userName || !categoryId) {
        return res.status(400).json({ message: 'Invalid request data. userName and categoryId are required.' });
    }

    // Refresh from file to ensure we have latest data
    userPredictions = getPredictionsFromFile();

    // Initialize user if doesn't exist
    if (!userPredictions[userName]) {
        userPredictions[userName] = {
            userName,
            predictions: {},
            lastUpdated: new Date().toISOString()
        };
    }

    // Update the specific category prediction
    if (selection) {
        userPredictions[userName].predictions[categoryId] = selection;
    } else {
        // If selection is null/empty, remove the prediction for that category
        delete userPredictions[userName].predictions[categoryId];
    }

    userPredictions[userName].lastUpdated = new Date().toISOString();

    savePredictionsToFile(userPredictions);

    res.status(200).json({
        message: 'Prediction saved!',
        userName,
        categoryId,
        selection,
        totalPredictions: Object.keys(userPredictions[userName].predictions).length
    });
});

// Submit/finalize all predictions
router.post('/', (req, res) => {
    const { userName, predictions } = req.body;

    if (!userName || !predictions || typeof predictions !== 'object') {
        return res.status(400).json({ message: 'Invalid request data.' });
    }

    // Refresh from file
    userPredictions = getPredictionsFromFile();

    // Save/update user predictions
    userPredictions[userName] = {
        userName,
        predictions,
        lastUpdated: new Date().toISOString(),
        isFinalized: true
    };

    savePredictionsToFile(userPredictions);

    res.status(201).json({
        message: 'Grammy predictions submitted successfully!',
        userName
    });
});

// Get user's predictions by username
router.get('/user/:username', (req, res) => {
    const username = req.params.username;

    // Refresh predictions from file
    userPredictions = getPredictionsFromFile();

    const userEntry = userPredictions[username];

    if (!userEntry) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json(userEntry);
});

// Get all predictions
router.get('/', (req, res) => {
    // Refresh predictions from file to ensure latest data
    userPredictions = getPredictionsFromFile();
    res.json(userPredictions);
});

// Get all usernames
router.get('/usernames', (req, res) => {
    // Refresh predictions from file to ensure latest data
    userPredictions = getPredictionsFromFile();
    const usernames = Object.keys(userPredictions);
    res.json(usernames);
});

// Delete user's predictions by username (for admin)
router.delete('/user/:username', (req, res) => {
    const usernameToDelete = req.params.username;

    // Refresh predictions from file
    userPredictions = getPredictionsFromFile();

    if (!userPredictions[usernameToDelete]) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Remove the user predictions
    delete userPredictions[usernameToDelete];

    // Save updated predictions
    savePredictionsToFile(userPredictions);

    res.json({
        message: `Successfully deleted Grammy predictions for ${usernameToDelete}`
    });
});

module.exports = {
    router,
    getPredictionsFromFile
};

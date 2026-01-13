const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/dailySpotlight.json');
const ARTISTS_FILE = path.join(__dirname, '../../oscar-frontend/public/grammysArtists.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

router.get('/', (req, res) => {
    try {
        // Read artists source file
        if (!fs.existsSync(ARTISTS_FILE)) {
            console.error('Artists file missing at:', ARTISTS_FILE);
            return res.status(500).json({ error: 'Artists file not found' });
        }

        const rawArtists = fs.readFileSync(ARTISTS_FILE, 'utf8');
        const artistsData = JSON.parse(rawArtists).artists;

        // Read current state
        let dailyData = {
            date: null,
            spotlight_ids: [],
            seen_artists: []
        };

        if (fs.existsSync(DATA_FILE)) {
            try {
                dailyData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            } catch (e) {
                console.error("Error reading dailySpotlight.json, resetting:", e);
            }
        }

        const TODAY_KEY = new Date().toDateString();

        // Check if we need to refresh the spotlight (New Day or Empty)
        if (dailyData.date !== TODAY_KEY || !dailyData.spotlight_ids || dailyData.spotlight_ids.length === 0) {
            console.log("Rolling new daily spotlight for date:", TODAY_KEY);

            // Filter out artists already seen
            // Ensure seen_artists is an array
            if (!Array.isArray(dailyData.seen_artists)) dailyData.seen_artists = [];

            let available = artistsData.filter(a => !dailyData.seen_artists.includes(a.artist));

            // If we've exhausted the list (or have fewer than 6 left), reset the cycle
            if (available.length < 6) {
                console.log("Cycle complete! Resetting seen artists list.");
                dailyData.seen_artists = [];
                available = [...artistsData];
            }

            // Shuffle
            const shuffled = [...available].sort(() => 0.5 - Math.random());

            // Pick top 6
            const selected = shuffled.slice(0, 6);
            const selectedIds = selected.map(a => a.artist);

            // Update state
            dailyData.date = TODAY_KEY;
            dailyData.spotlight_ids = selectedIds;
            dailyData.seen_artists = [...dailyData.seen_artists, ...selectedIds];

            // Save to file
            fs.writeFileSync(DATA_FILE, JSON.stringify(dailyData, null, 2));
        }

        // Return full artist objects
        const spotlightArtists = dailyData.spotlight_ids
            .map(id => artistsData.find(a => a.artist === id))
            .filter(Boolean)
            .map(artistObj => ({
                artist: artistObj.artist,
                nominations: artistObj.nominations
            }));

        res.json(spotlightArtists);

    } catch (e) {
        console.error('Error in daily spotlight route:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

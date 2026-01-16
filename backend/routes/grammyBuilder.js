const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ARTISTS_FILE = path.join(__dirname, '../../oscar-frontend/public/grammysArtists.json');
const NOMINEE_FILE = path.join(__dirname, '../../oscar-frontend/public/grammys.json');

router.get('/', (req, res) => {
    try {
        // Read artists Source of Truth (with images/metadata)
        if (!fs.existsSync(ARTISTS_FILE)) {
            console.error('Artists file missing at:', ARTISTS_FILE);
            return res.status(500).json({ error: 'Artists file not found' });
        }

        const rawArtists = fs.readFileSync(ARTISTS_FILE, 'utf8');
        const artistsData = JSON.parse(rawArtists).artists;

        // Create a quick lookup map for performance
        // Key: "Artist Name|Work Name" (or just "Artist Name|null") -> valid Metadata Object
        const metadataMap = new Map();
        artistsData.forEach(artistObj => {
            if (artistObj.nominations) {
                artistObj.nominations.forEach(nom => {
                    const key = `${artistObj.artist}|${nom.work || 'null'}`;
                    metadataMap.set(key, nom);
                });
            }
        });

        let grammyEvent = {};

        // Read the Ballot Structure
        if (fs.existsSync(NOMINEE_FILE)) {
            try {
                grammyEvent = JSON.parse(fs.readFileSync(NOMINEE_FILE, 'utf8'));
            } catch (e) {
                console.error("Error reading grammys.json:", e);
                return res.status(500).json({ error: 'Error reading ballot data' });
            }
        }

        // Merge Metadata into Ballot
        if (grammyEvent.fields) {
            grammyEvent.fields.forEach(field => {
                field.categories.forEach(category => {
                    category.nominees.forEach(nominee => {
                        // Construct key to find metadata
                        const key = `${nominee.artist}|${nominee.work || 'null'}`;
                        const metadata = metadataMap.get(key);

                        if (metadata) {
                            nominee.spotify_image = metadata.spotify_image || nominee.spotify_image;
                            nominee.spotify_preview_url = metadata.spotify_preview_url || nominee.spotify_preview_url;
                            nominee.spotify_url = metadata.spotify_url || nominee.spotify_url;
                            nominee.spotify_uri = metadata.spotify_uri || nominee.spotify_uri; // Ensure URI is synced
                        }
                    });
                });
            });
        }

        res.json(grammyEvent);

    } catch (e) {
        console.error('Error in grammyBuilder route:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

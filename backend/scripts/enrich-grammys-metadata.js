const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let SPOTIFY_ACCESS_TOKEN = null;

// File Paths
const ARTISTS_FILE = path.join(__dirname, '../../oscar-frontend/public/grammysArtists.json');
// Optional: If you want to sync grammys.json too, uncomment this
const NOMINEE_FILE = path.join(__dirname, '../../oscar-frontend/public/grammys.json');

async function getAccessToken() {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'client_credentials'
            }),
            {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        SPOTIFY_ACCESS_TOKEN = response.data.access_token;
        console.log('✅ Got Spotify access token');
    } catch (error) {
        console.error('❌ Error getting access token:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Helper to batch process IDs
async function fetchBatch(ids, type) {
    if (!ids || ids.length === 0) return {};

    // Max batch sizes: tracks=50, artists=50, albums=20
    const batchSize = type === 'albums' ? 20 : 50;
    const chunks = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        chunks.push(ids.slice(i, i + batchSize));
    }

    const results = {};
    const endpoint = `https://api.spotify.com/v1/${type}`;

    for (const chunk of chunks) {
        try {
            console.log(`fetching batch of ${chunk.length} ${type}...`);
            const response = await axios.get(endpoint, {
                params: { ids: chunk.join(',') },
                headers: { 'Authorization': `Bearer ${SPOTIFY_ACCESS_TOKEN}` }
            });

            const data = response.data[type]; // tracks, albums, or artists
            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item) {
                        results[item.id] = item;
                    }
                });
            }
        } catch (error) {
            console.error(`Error fetching batch ${type}:`, error.message);
        }
    }
    return results;
}

async function enrichMetadata() {
    await getAccessToken();

    if (!fs.existsSync(ARTISTS_FILE)) {
        console.error('File not found:', ARTISTS_FILE);
        return;
    }

    const fileContent = JSON.parse(fs.readFileSync(ARTISTS_FILE, 'utf8'));
    const allNominations = []; // Helper to store refs to objects we need to update

    // Arrays to collect IDs
    const trackIds = new Set();
    const albumIds = new Set();
    const artistIds = new Set();

    // 1. Scan file and collect URIs
    console.log("Scanning file for Spotify URIs...");

    // Handle specific file structure: "artists" -> array of { artist, nominations: [] }
    if (fileContent.artists && Array.isArray(fileContent.artists)) {
        for (const artistObj of fileContent.artists) {
            if (artistObj.nominations) {
                for (const nom of artistObj.nominations) {
                    if (nom.spotify_uri) {
                        const parts = nom.spotify_uri.split(':');
                        if (parts.length === 3) {
                            const type = parts[1];
                            const id = parts[2];

                            // Store ID for batch fetching
                            if (type === 'track') trackIds.add(id);
                            else if (type === 'album') albumIds.add(id);
                            else if (type === 'artist') artistIds.add(id);

                            allNominations.push({ ref: nom, type, id });
                        }
                    }
                }
            }
        }
    }

    console.log(`Found: ${trackIds.size} tracks, ${albumIds.size} albums, ${artistIds.size} artists.`);

    // 2. Fetch Metadata
    const tracksMap = await fetchBatch(Array.from(trackIds), 'tracks');
    const albumsMap = await fetchBatch(Array.from(albumIds), 'albums');
    const artistsMap = await fetchBatch(Array.from(artistIds), 'artists');

    // 3. Update Objects
    let updateCount = 0;

    for (const item of allNominations) {
        const { ref, type, id } = item;
        let data = null;
        let imageUrl = null;
        let spotifyUrl = null;
        let previewUrl = null;

        if (type === 'track') {
            data = tracksMap[id];
            if (data) {
                // Tracks -> album -> images
                if (data.album && data.album.images && data.album.images.length > 0) {
                    imageUrl = data.album.images[0].url; // Highest res
                }
                spotifyUrl = data.external_urls?.spotify;
                previewUrl = data.preview_url;
            }
        } else if (type === 'album') {
            data = albumsMap[id];
            if (data) {
                if (data.images && data.images.length > 0) {
                    imageUrl = data.images[0].url;
                }
                spotifyUrl = data.external_urls?.spotify;
            }
        } else if (type === 'artist') {
            data = artistsMap[id];
            if (data) {
                if (data.images && data.images.length > 0) {
                    imageUrl = data.images[0].url;
                }
                spotifyUrl = data.external_urls?.spotify;
            }
        }

        // Apply to JSON object
        let changed = false;
        if (imageUrl && ref.spotify_image !== imageUrl) {
            ref.spotify_image = imageUrl;
            changed = true;
        }
        if (spotifyUrl && ref.spotify_url !== spotifyUrl) {
            ref.spotify_url = spotifyUrl;
            changed = true;
        }
        if (previewUrl && ref.spotify_preview_url !== previewUrl) {
            ref.spotify_preview_url = previewUrl;
            changed = true;
        }

        if (changed) updateCount++;
    }

    // 4. Save
    fs.writeFileSync(ARTISTS_FILE, JSON.stringify(fileContent, null, 4));
    console.log(`\n🎉 Success! Updated metadata for ${updateCount} nominations.`);
    console.log(`Saved to ${ARTISTS_FILE}`);
}

enrichMetadata();

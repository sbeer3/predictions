const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let SPOTIFY_ACCESS_TOKEN = null;

// Get access token using Client Credentials flow
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
        console.log('✅ Got Spotify access token!');
        return SPOTIFY_ACCESS_TOKEN;
    } catch (error) {
        console.error('❌ Error getting access token:', error.response?.data || error.message);
        throw error;
    }
}

const MANUAL_OVERRIDES = {
    "Anderson .Paak|No Cap (with Disclosure)": "spotify:track:6zaeVCwnf3A9S8R7QfDHQW",
    "Disclosure|No Cap (with Anderson .Paak)": "spotify:track:6zaeVCwnf3A9S8R7QfDHQW",
    "Ariana Grande|Defying Gravity (with Cynthia Erivo)": "spotify:track:4h1UeG4p4f9F6K0F0Y5L9X",
    "Cynthia Erivo|Defying Gravity (with Ariana Grande)": "spotify:track:4h1UeG4p4f9F6K0F0Y5L9X",
    "Chris Stapleton|A Song To Sing (with Miranda Lambert)": "spotify:track:7L9N5bxblTyzTknaxo7duX",
    "Miranda Lambert|A Song To Sing (with Chris Stapleton)": "spotify:track:7L9N5bxblTyzTknaxo7duX",
    "Shaboozey|Amen (with Jelly Roll)": "spotify:track:2iSfSJrho5XkU2NmAnZ9ZV",
    "Jelly Roll|Amen (with Shaboozey)": "spotify:track:2iSfSJrho5XkU2NmAnZ9ZV"
};

async function searchSpotify(query, type = 'track,album,artist') {
    try {
        const response = await axios.get('https://api.spotify.com/v1/search', {
            params: {
                q: query,
                type: type,
                limit: 1
            },
            headers: {
                'Authorization': `Bearer ${SPOTIFY_ACCESS_TOKEN}`
            }
        });

        // Priority: Track > Album > Artist
        if (response.data.tracks && response.data.tracks.items.length > 0) {
            return {
                uri: response.data.tracks.items[0].uri,
                name: response.data.tracks.items[0].name
            };
        } else if (response.data.albums && response.data.albums.items.length > 0) {
            return {
                uri: response.data.albums.items[0].uri,
                name: response.data.albums.items[0].name
            };
        } else if (response.data.artists && response.data.artists.items.length > 0) {
            return {
                uri: response.data.artists.items[0].uri,
                name: response.data.artists.items[0].name
            };
        }
        return null;
    } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
        return null;
    }
}

async function updateGrammysArtists() {
    // First, get access token
    await getAccessToken();

    // Path to the frontend public file
    const grammysPath = path.join(__dirname, '../../oscar-frontend/public/grammysArtists.json');

    if (!fs.existsSync(grammysPath)) {
        console.error(`❌ File not found at: ${grammysPath}`);
        return;
    }

    const grammysData = JSON.parse(fs.readFileSync(grammysPath, 'utf8'));

    let updated = 0;
    let total = 0;

    console.log(`Processing ${grammysData.artists.length} artists...`);

    // Iterate through artists
    for (const artistEntry of grammysData.artists) {
        const artistName = artistEntry.artist;
        console.log(`\n🎤 Artist: ${artistName}`);

        // Iterate through nominations for this artist
        for (const nomination of artistEntry.nominations) {
            total++;
            const workKey = `${artistName}|${nomination.work}`;

            // 1. Check Manual Overrides
            if (MANUAL_OVERRIDES[workKey]) {
                const overrideUri = MANUAL_OVERRIDES[workKey];
                if (nomination.spotify_uri !== overrideUri) {
                    nomination.spotify_uri = overrideUri;
                    updated++;
                    console.log(`    🛠️  Overridden: ${overrideUri}`);
                } else {
                    console.log(`    ✅ Verified (Override): ${overrideUri}`);
                }
                continue;
            }

            let searchQuery = '';
            let searchType = 'track'; // default

            if (nomination.category === 'Best New Artist') {
                searchQuery = artistName;
                searchType = 'artist';
            } else if (nomination.work) {
                searchQuery = `${nomination.work} ${artistName}`;
                // Guess type based on category name
                if (nomination.category.includes('Album')) {
                    searchType = 'album';
                } else if (nomination.category.includes('Song') || nomination.category.includes('Performance') || nomination.category.includes('Record')) {
                    searchType = 'track';
                }
            } else {
                // Fallback
                searchQuery = artistName;
                searchType = 'artist';
            }

            console.log(`    🔍 Searching [${searchType}]: ${searchQuery}`);

            // Call search with specific type preference if possible, or broad
            const result = await searchSpotify(searchQuery, searchType);

            if (result && result.uri) {
                // Only update if different (or if we want to force update)
                if (nomination.spotify_uri !== result.uri) {
                    nomination.spotify_uri = result.uri;
                    updated++;
                    console.log(`    ✅ Updated to: ${result.name} (${result.uri})`);
                } else {
                    console.log(`    ✨ Verified: ${result.name} (${result.uri})`);
                }
            } else {
                console.log(`    ❌ Not found`);
            }

            // Rate limiting - wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Save updated JSON
    fs.writeFileSync(grammysPath, JSON.stringify(grammysData, null, 4));
    console.log(`\n🎉 Done!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total Nominations Checked: ${total}`);
}

// Run the script
updateGrammysArtists().catch(console.error);

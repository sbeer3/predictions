const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '4738bec017cc4268bde007e8bfbaac9f';
const CLIENT_SECRET = 'a42717c076c9429585f85f1174f56796';

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

async function searchSpotify(query, type = 'track,album') {
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

        // Return the first result
        if (response.data.tracks && response.data.tracks.items.length > 0) {
            return response.data.tracks.items[0].uri;
        } else if (response.data.albums && response.data.albums.items.length > 0) {
            return response.data.albums.items[0].uri;
        }
        return null;
    } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
        return null;
    }
}

async function addSpotifyURIs() {
    // First, get access token
    await getAccessToken();

    const grammysPath = path.join(__dirname, '../grammys.json');
    const grammys = JSON.parse(fs.readFileSync(grammysPath, 'utf8'));

    let updated = 0;
    let total = 0;
    let skipped = 0;

    // Iterate through fields
    for (const field of grammys.fields) {
        console.log(`\n🎵 Field: ${field.field_name}`);

        // Iterate through categories in each field
        for (const category of field.categories) {
            console.log(`  📁 Category: ${category.name}`);

            if (!category.nominees || !Array.isArray(category.nominees)) {
                console.log(`    ⚠️  No nominees array found`);
                continue;
            }

            for (const nominee of category.nominees) {
                total++;

                // Skip if URI already exists
                if (nominee.spotify_uri) {
                    skipped++;
                    continue;
                }

                // Use search_query if available, otherwise construct one
                let searchQuery = nominee.search_query;
                if (!searchQuery) {
                    if (nominee.work && nominee.artist) {
                        searchQuery = `${nominee.work} ${nominee.artist}`;
                    } else if (nominee.name) {
                        searchQuery = nominee.name;
                    } else {
                        console.log(`    ⚠️  No search query available`);
                        continue;
                    }
                }

                console.log(`    🔍 ${searchQuery}`);
                const uri = await searchSpotify(searchQuery);

                if (uri) {
                    nominee.spotify_uri = uri;
                    updated++;
                    console.log(`    ✅ ${uri}`);
                } else {
                    console.log(`    ❌ Not found`);
                }

                // Rate limiting - wait 100ms between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    // Save updated JSON
    fs.writeFileSync(grammysPath, JSON.stringify(grammys, null, 2));
    console.log(`\n🎉 Done!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already had URI): ${skipped}`);
    console.log(`   Total: ${total}`);
}

// Run the script
addSpotifyURIs().catch(console.error);

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '4738bec017cc4268bde007e8bfbaac9f';
const CLIENT_SECRET = '33bad69546f64d6fbfa937a49f8c5a9c';

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
        // console.log(`       Sending API request for: ${query}`);
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

        let item = null;
        if (response.data.tracks && response.data.tracks.items.length > 0) {
            item = response.data.tracks.items[0];
        } else if (response.data.albums && response.data.albums.items.length > 0) {
            item = response.data.albums.items[0];
        }

        if (item) {
            const image = item.album ? item.album.images[0]?.url : (item.images ? item.images[0]?.url : null);
            return {
                uri: item.uri,
                image: image,
                name: item.name,
                artist: item.artists ? item.artists[0].name : 'Unknown'
            };
        }
        return null;
    } catch (error) {
        // console.error(`       API Error searching for "${query}":`, error.message);
        return null;
    }
}

async function getSpotifyDetails(uri) {
    const parts = uri.split(':');
    if (parts.length !== 3) return null;

    const type = parts[1];
    const id = parts[2];

    try {
        const response = await axios.get(`https://api.spotify.com/v1/${type}s/${id}`, {
            headers: {
                'Authorization': `Bearer ${SPOTIFY_ACCESS_TOKEN}`
            }
        });

        const item = response.data;
        const image = (type === 'track') ? item.album?.images[0]?.url : item.images?.[0]?.url;

        return {
            uri: uri,
            image: image
        };
    } catch (error) {
        console.error(`Error fetching details for ${uri}:`, error.message);
        return null;
    }
}

// Check if an artist string looks like a formatted list of songwriters/credits
function isComplexArtistString(artistName) {
    if (!artistName) return false;
    // Check for multiple separators usually found in credits
    const commaCount = (artistName.match(/,/g) || []).length;
    return commaCount > 2 || artistName.length > 60;
}

// Extract a simplified artist name (first person in list)
function getPrimaryArtist(artistName) {
    if (!artistName) return '';
    // Split by comma, &, or "Featuring"
    const splitters = [',', '&', 'Featuring', 'Feat.', ';', ' With '];
    let simplified = artistName;

    for (const sep of splitters) {
        if (simplified.includes(sep)) {
            simplified = simplified.split(sep)[0];
        }
    }
    return simplified.trim();
}

async function addSpotifyURIs() {
    await getAccessToken();

    const grammysPath = path.join(__dirname, '../../oscar-frontend/public/grammys.json');
    console.log(`Reading from: ${grammysPath}`);

    if (!fs.existsSync(grammysPath)) {
        console.error("❌ File not found:", grammysPath);
        return;
    }

    const grammys = JSON.parse(fs.readFileSync(grammysPath, 'utf8'));

    // PASS 1: Build Metadata Cache from "Good" Categories
    // We assume Record/Album/Performance categories have cleaner data.
    const workMetadata = new Map(); // Key: WorkName -> { uri, image }

    console.log("🔍 Pass 1: Building Work Metadata Cache...");
    for (const field of grammys.fields) {
        for (const category of field.categories) {
            if (!category.nominees) continue;
            for (const nominee of category.nominees) {
                if (nominee.work && nominee.spotify_uri && nominee.spotify_image) {
                    // Only cache if it looks like a track/album URI
                    if (nominee.spotify_uri.includes(':track:') || nominee.spotify_uri.includes(':album:')) {
                        workMetadata.set(nominee.work.toLowerCase(), {
                            uri: nominee.spotify_uri,
                            image: nominee.spotify_image
                        });
                    }
                }
            }
        }
    }
    console.log(`✅ Cache built with ${workMetadata.size} unique works.`);


    // PASS 2: Fix Missing or Suspicious Entries
    let updated = 0;

    for (const field of grammys.fields) {
        console.log(`\n🎵 Field: ${field.field_name}`);

        for (const category of field.categories) {
            console.log(`  📁 Category: ${category.name}`);

            if (!category.nominees) continue;

            for (const nominee of category.nominees) {

                // Determine if we need to process this nominee
                // We process if: 
                // 1. Missing URI
                // 2. Missing Image
                // 3. (Optional) We could re-verify suspected bad links here, but for now let's focus on filling gaps/fixing known bad patterns.

                let needsUpdate = !nominee.spotify_uri || !nominee.spotify_image;

                // Heuristic: If we have a URI but the artist string was SUPER complex, maybe it was a bad search before? 
                // Let's assume previous run filled some bad data if we want to overwrite.
                // For now, let's trust the user's report: "incorrectly labeled". 
                // We will attempt to Overwrite if we find a better match in our Cache.

                if (nominee.work && workMetadata.has(nominee.work.toLowerCase())) {
                    const cached = workMetadata.get(nominee.work.toLowerCase());
                    if (cached.uri !== nominee.spotify_uri) {
                        console.log(`    ♻️  Found better match in cache for "${nominee.work}"`);
                        nominee.spotify_uri = cached.uri;
                        nominee.spotify_image = cached.image;
                        updated++;
                        continue; // Done
                    }
                }

                if (!needsUpdate) continue;

                // Processing logic for missing/incomplete items
                console.log(`    Processing: ${nominee.work || nominee.artist}`);

                let result = null;

                // Strategy 1: Look in Cache (already did, but double check)
                if (nominee.work && workMetadata.has(nominee.work.toLowerCase())) {
                    // Should have been caught above, but safety net
                    result = workMetadata.get(nominee.work.toLowerCase());
                    console.log(`       ✅ Cache Hit!`);
                }

                // Strategy 2: Smart Search
                else {
                    let searchQueries = [];
                    const simpleArtist = getPrimaryArtist(nominee.artist);

                    // Priority 1: Work + Simple Artist
                    if (nominee.work && simpleArtist) {
                        searchQueries.push(`${nominee.work} ${simpleArtist}`);
                    }

                    // Priority 2: Work + Full Artist (if not too complex)
                    if (nominee.work && nominee.artist && !isComplexArtistString(nominee.artist)) {
                        searchQueries.push(`${nominee.work} ${nominee.artist}`);
                    }

                    // Priority 3: Work only (Riskier, but effective for unique titles)
                    if (nominee.work) {
                        searchQueries.push(nominee.work);
                    }

                    // Priority 4: Artist only (if no work)
                    if (!nominee.work && nominee.artist) {
                        searchQueries.push(nominee.artist);
                    } else if (nominee.name) {
                        searchQueries.push(nominee.name);
                    }

                    // Remove duplicates
                    searchQueries = [...new Set(searchQueries)];

                    for (const query of searchQueries) {
                        console.log(`       🔍 Trying query: ${query}`);
                        result = await searchSpotify(query);
                        if (result) {
                            console.log(`       ✅ Found: ${result.name} by ${result.artist}`);
                            break;
                        } else {
                            // console.log("       ❌ No results.");
                        }
                        // Small delay between retries
                        await new Promise(r => setTimeout(r, 200));
                    }
                }

                if (result) {
                    nominee.spotify_uri = result.uri || nominee.spotify_uri;
                    nominee.spotify_image = result.image || nominee.spotify_image;
                    updated++;
                    // Add to cache to help future lookups
                    if (nominee.work) {
                        workMetadata.set(nominee.work.toLowerCase(), {
                            uri: nominee.spotify_uri,
                            image: nominee.spotify_image
                        });
                    }
                } else {
                    console.log(`       ❌ FAILED to find match.`);
                }

                // Rate limit
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    fs.writeFileSync(grammysPath, JSON.stringify(grammys, null, 2));
    console.log(`\n🎉 Done! Updated ${updated} entries.`);
}

addSpotifyURIs().catch(console.error);

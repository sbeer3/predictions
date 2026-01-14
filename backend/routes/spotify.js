const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';

// Exchange authorization code for access token
router.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.redirect(`${FRONTEND_URL}/#error=no_code`);
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token, expires_in } = response.data;

        // Redirect back to frontend with all tokens
        const params = new URLSearchParams({
            access_token,
            refresh_token,
            expires_in
        });

        res.redirect(`${FRONTEND_URL}/#${params.toString()}`);
    } catch (error) {
        console.error('Spotify token exchange error:', error.response?.data || error.message);
        res.redirect(`${FRONTEND_URL}/#error=token_exchange_failed`);
    }
});

// Refresh access token
router.get('/refresh_token', async (req, res) => {
    const refresh_token = req.query.refresh_token;

    if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refresh_token,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, expires_in } = response.data;

        res.json({
            access_token,
            expires_in
        });
    } catch (error) {
        console.error('Spotify token refresh error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

module.exports = router;

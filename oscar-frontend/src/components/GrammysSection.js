import React, { useState, useEffect } from 'react';
import SpotifyPlayer from '../scripts/SpotifyPlayer';
import PredictionForm from './PredictionForm';
import '../styles/spotify.css';

function GrammysSection({
    currentUserName,
    currentYear,
    selectedEvent,
    isEditingPredictions,
    gameSettings,
    categories,
    previousPredictions,
    onSubmitPredictions,
    handleViewLeaderboardFromGreeting,
    handleLogout
}) {
    const [spotifyToken, setSpotifyToken] = useState(() => {
        const token = localStorage.getItem('spotify_token');
        const refreshToken = localStorage.getItem('spotify_refresh_token');

        // Migration check: If we have an access token but NO refresh token,
        // clear the legacy token to force re-authentication.
        if (token && !refreshToken) {
            console.log("Legacy session detected (no refresh token). Clearing to force re-auth.");
            localStorage.removeItem('spotify_token');
            return null;
        }

        return token || null;
    });

    const [spotifyRefreshToken, setSpotifyRefreshToken] = useState(() => {
        return localStorage.getItem('spotify_refresh_token') || null;
    });

    const [tokenExpiration, setTokenExpiration] = useState(() => {
        return localStorage.getItem('spotify_token_expires_at') || null;
    });

    // Internal view state: 'greeting' or 'form'
    const [viewMode, setViewMode] = useState('greeting');

    // Featured artists for daily spotlight
    const [featuredArtists, setFeaturedArtists] = useState([]);
    const [currentArtistIndex, setCurrentArtistIndex] = useState(0);

    // Playback request state for Spotify Player
    const [playRequest, setPlayRequest] = useState(null);

    // Load Daily Spotlight from Backend
    useEffect(() => {
        const loadSpotlight = async () => {
            try {
                // Fetch the centralized daily spotlight from the server
                const response = await fetch('/api/spotlight');
                const data = await response.json();

                if (Array.isArray(data)) {
                    setFeaturedArtists(data);
                }
            } catch (error) {
                console.error('Error loading daily spotlight:', error);
            }
        };

        loadSpotlight();
    }, []);

    const nextArtist = () => {
        setCurrentArtistIndex((prev) => (prev + 1) % featuredArtists.length);
    };

    const prevArtist = () => {
        setCurrentArtistIndex((prev) => (prev - 1 + featuredArtists.length) % featuredArtists.length);
    };

    const handleSpotifyAuth = () => {
        // Spotify OAuth configuration
        const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
        const REDIRECT_URI = process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
        const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';

        const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

        // Redirect in the same window
        window.location.href = authUrl;
    };

    const refreshSpotifyToken = async () => {
        if (!spotifyRefreshToken) {
            console.log("No refresh token available to refresh.");
            return;
        }

        console.log("Refreshing Spotify token...");
        try {
            const response = await fetch(`/api/spotify/refresh_token?refresh_token=${spotifyRefreshToken}`);
            if (response.ok) {
                const data = await response.json();
                console.log("Token refreshed successfully");

                setSpotifyToken(data.access_token);
                localStorage.setItem('spotify_token', data.access_token);

                if (data.expires_in) {
                    const expiresAt = Date.now() + (data.expires_in * 1000);
                    setTokenExpiration(expiresAt);
                    localStorage.setItem('spotify_token_expires_at', expiresAt);
                }
            } else {
                console.error("Failed to refresh token:", await response.text());
                // If refresh fails with 400/401, clear data so user re-auths
                if (response.status === 400 || response.status === 401) {
                    clearSpotifyData();
                }
            }
        } catch (error) {
            console.error("Error refreshing token:", error);
        }
    };

    // Check for expiration on mount
    useEffect(() => {
        if (spotifyToken) {
            // If no expiration time is stored, refresh to be safe and get a time
            if (!tokenExpiration) {
                console.log("No expiration time found. Refreshing to ensure validity.");
                refreshSpotifyToken();
                return;
            }

            const timeLeft = tokenExpiration - Date.now();
            // If expired or expiring in less than 5 minutes, refresh immediately
            if (timeLeft < 300000) {
                console.log("Token expired or expiring soon. Refreshing immediately.");
                refreshSpotifyToken();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Set up auto-refresh timer
    useEffect(() => {
        if (!spotifyToken || !tokenExpiration) return;

        const timeLeft = tokenExpiration - Date.now();
        const refreshTime = timeLeft - 300000; // Refresh 5 minutes before expiration

        if (refreshTime > 0) {
            console.log(`Scheduling token refresh in ${Math.floor(refreshTime / 1000 / 60)} minutes`);
            const timer = setTimeout(() => {
                refreshSpotifyToken();
            }, refreshTime);

            return () => clearTimeout(timer);
        }
    }, [spotifyToken, tokenExpiration]);

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash.includes('access_token')) {
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresIn = params.get('expires_in');

            if (token) {
                console.log('Tokens received from redirect');
                setSpotifyToken(token);
                localStorage.setItem('spotify_token', token);

                if (refreshToken) {
                    setSpotifyRefreshToken(refreshToken);
                    localStorage.setItem('spotify_refresh_token', refreshToken);
                }

                if (expiresIn) {
                    const expiresAt = Date.now() + (expiresIn * 1000);
                    setTokenExpiration(expiresAt);
                    localStorage.setItem('spotify_token_expires_at', expiresAt);
                }

                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

    const handleStartPrediction = () => {
        setViewMode('form');
    };

    const handlePredictionSubmit = (predictions) => {
        onSubmitPredictions(predictions);
        setViewMode('greeting');
    };

    const handleTokenExpired = async () => {
        console.log("Token expired (reported by Player). Attempting refresh...");
        await refreshSpotifyToken();
    };

    const clearSpotifyData = () => {
        setSpotifyToken(null);
        setSpotifyRefreshToken(null);
        setTokenExpiration(null);
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expires_at');
    };

    return (
        <>
            {viewMode === 'greeting' ? (
                <>
                    <div className="header">
                        <h1>{selectedEvent === 'grammys' ? `${currentYear} Grammys` : `${currentYear} Oscars`}</h1>
                    </div>
                    <div id="user-greeting-section">
                        <div className="welcome-container">
                            <div className="hero-content">
                                <h2>Welcome, {currentUserName}!</h2>
                            </div>

                            {isEditingPredictions ? (
                                <p className="greeting-text editing-mode">
                                    You already have predictions submitted. You can edit them if you'd like.
                                </p>
                            ) : (
                                <p className="greeting-text">
                                    You're all set to make your predictions for the {currentYear} annual Grammys! While you wait, listen to the daily Grammy nominations leading up to the big day!
                                    Of course, we dont we wont have time to listen to every nomination, but here are some hand-picked tracks to keep you company while you make your predictions!
                                </p>
                            )}

                            {/* Daily Spotlight Stepper */}
                            <div className="daily-spotlight">
                                <div className="spotlight-header">
                                    <p className="spotlight-subtitle">Featured Grammy Nominee</p>
                                </div>

                                {featuredArtists.length > 0 && (
                                    <div className="spotlight-stepper-container">
                                        <button className="stepper-nav-btn prev" onClick={prevArtist}>←</button>

                                        <div className="spotlight-active-card">
                                            {(() => {
                                                const artist = featuredArtists[currentArtistIndex];
                                                const icons = ['🎤', '⭐', '🐰', '💫', '🎸', '🎹', '🎺', '🎻'];
                                                const icon = icons[currentArtistIndex % icons.length];

                                                return (
                                                    <div className="spotlight-card">
                                                        <div className="spotlight-card-header">
                                                            <div className="spotlight-artist-info">
                                                                <span className="artist-icon">{icon}</span>
                                                                <div className="spotlight-artist">{artist.artist}</div>
                                                            </div>
                                                        </div>

                                                        <div className="spotlight-nominations">
                                                            {artist.nominations.map((nom, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    className="nomination-row"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPlayRequest({
                                                                            uri: nom.spotify_uri,
                                                                            timestamp: Date.now()
                                                                        });
                                                                    }}
                                                                >
                                                                    <span className="play-btn-small">▶</span>
                                                                    <div className="nom-details">
                                                                        <span className="nom-category">{nom.category}</span>
                                                                        {nom.work && <span className="nom-work">"{nom.work}"</span>}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <button className="stepper-nav-btn next" onClick={nextArtist}>→</button>

                                        <div className="stepper-dots">
                                            {featuredArtists.map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`stepper-dot ${idx === currentArtistIndex ? 'active' : ''}`}
                                                    onClick={() => setCurrentArtistIndex(idx)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>


                            {/* <div className="action-buttons">
                                <button
                                    onClick={handleStartPrediction}
                                    className={`start-button ${isEditingPredictions ? 'edit-mode' : ''}`}
                                    disabled={isEditingPredictions && !gameSettings.allowEditing}
                                >
                                    <span className="button-icon">{isEditingPredictions ? '✏️' : '🎬'}</span>
                                    {isEditingPredictions
                                        ? (gameSettings.allowEditing ? 'Edit My Predictions' : 'Predictions Locked')
                                        : 'Make My Predictions'
                                    }
                                </button>
                                <button onClick={handleViewLeaderboardFromGreeting} className="leaderboard-button">
                                    <span className="button-icon">🏆</span>
                                    View Leaderboard
                                </button>
                            </div> */}

                            {!gameSettings.allowEditing && isEditingPredictions && (
                                <div className="editing-disabled-message">
                                    Editing predictions is currently disabled by the admin.
                                </div>
                            )}

                            <button onClick={handleLogout} className="logout-button-small">
                                Change User
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="header">
                        <h1>{selectedEvent === 'grammys' ? `${currentYear} Grammys` : `${currentYear} Oscars`}</h1>
                        <div className="user-info">
                            <span>
                                {isEditingPredictions ? 'Editing' : 'Making'} predictions as: <strong>{currentUserName}</strong>
                            </span>
                            {/* <button onClick={handleLogout} className="logout-button">Change User</button> */}
                        </div>
                    </div>
                    <PredictionForm
                        categories={categories}
                        onSubmitPredictions={handlePredictionSubmit}
                        initialPredictions={previousPredictions}
                        isEditing={isEditingPredictions}
                    />
                </>
            )}

            {/* Spotify Player - Always visible across all views */}
            <SpotifyPlayer
                token={spotifyToken}
                onAuthRequired={handleSpotifyAuth}
                onTokenInvalid={handleTokenExpired}
                playRequest={playRequest}
            />
        </>
    );
}

export default GrammysSection;
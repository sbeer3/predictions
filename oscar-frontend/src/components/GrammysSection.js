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
        // Try to load token from localStorage on mount
        return localStorage.getItem('spotify_token') || null;
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

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        if (hash.includes('access_token')) {
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');

            if (token) {
                console.log('Token received from redirect:', token);
                setSpotifyToken(token);
                localStorage.setItem('spotify_token', token);
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

    const handleTokenExpired = () => {
        console.log("Token expired or invalid. Clearing...");
        setSpotifyToken(null);
        localStorage.removeItem('spotify_token');
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
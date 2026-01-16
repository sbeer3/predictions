import React, { useState, useEffect } from 'react';

const SpotifyPlayer = ({ token, onAuthRequired, onTokenInvalid, playRequest }) => {
    const [player, setPlayer] = useState(undefined);
    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [current_track, setTrack] = useState(null);
    const [deviceId, setDeviceId] = useState(null);

    useEffect(() => {
        if (!token) return;

        // Initialize the Player once the SDK is ready
        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Grammys Prediction Player',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            setPlayer(player);

            // Add Event Listeners
            player.addListener('ready', ({ device_id }) => {
                console.log('Spotify Player Ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setDeviceId(null);
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error('Failed to initialize Spotify Player', message);
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('Failed to authenticate Spotify Player', message);
                onTokenInvalid && onTokenInvalid();
            });

            player.addListener('account_error', ({ message }) => {
                console.error('Failed to validate Spotify account', message);
            });

            player.addListener('player_state_changed', (state => {
                if (!state) {
                    return;
                }
                setTrack(state.track_window.current_track);
                setPaused(state.paused);

                player.getCurrentState().then(state => {
                    (!state) ? setActive(false) : setActive(true)
                });
            }));

            player.connect();
        };

        // Dynamically load the Spotify SDK script if it doesn't exist
        if (!document.getElementById('spotify-player-script')) {
            const script = document.createElement('script');
            script.id = 'spotify-player-script';
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);
        } else if (window.Spotify) {
            // Trigger SDK ready if it's already loaded
            window.onSpotifyWebPlaybackSDKReady();
        }
    }, [token]);

    // Automatically transfer playback to this device when ready
    useEffect(() => {
        if (deviceId && token) {
            const transferPlayback = async () => {
                try {
                    await fetch('https://api.spotify.com/v1/me/player', {
                        method: 'PUT',
                        body: JSON.stringify({ device_ids: [deviceId], play: true }), // Create active session
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });
                } catch (e) {
                    console.error("Error transferring playback:", e);
                }
            };
            transferPlayback();
        }
    }, [deviceId, token]);

    // Handle play requests from parent
    useEffect(() => {
        if (playRequest) {
            console.log("SpotifyPlayer received playRequest:", playRequest);
            console.log("Current State - DeviceID:", deviceId, "Token:", !!token);
        }

        if (playRequest && deviceId && token) {
            const playTrack = async () => {
                console.log("Attempting to play:", playRequest.uri);
                const body = {};

                // Determine if it's a track list or a context (album/playlist/artist)
                if (playRequest.uri.includes(':track:')) {
                    body.uris = [playRequest.uri];
                } else {
                    body.context_uri = playRequest.uri;
                }

                try {
                    // First ensure we are the active device (FORCE ACTIVATION)
                    await fetch('https://api.spotify.com/v1/me/player', {
                        method: 'PUT',
                        body: JSON.stringify({ device_ids: [deviceId], play: false }),
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });

                    // Then send the play command
                    const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                        method: 'PUT',
                        body: JSON.stringify(body),
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });

                    if (playRes.status === 204) {
                        console.log("✅ Playback started successfully!");
                    } else if (playRes.status === 401) {
                        console.error("❌ 401 Unauthorized during play command");
                        onTokenInvalid && onTokenInvalid();
                        return;
                    } else {
                        const errorData = await playRes.json();
                        console.error("❌ Spotify Play Error:", playRes.status, errorData);
                    }

                } catch (e) {
                    console.error("Error playing content:", e);
                } finally {
                    player.togglePlay();
                }
            };
            playTrack();
        }
    }, [playRequest, deviceId, token, player]);

    // If no token, show connect button
    if (!token) {
        return (
            <div className="spotify-player-wrapper">
                <div className="spotify-connect">
                    <h3>🎵 Connect Spotify</h3>
                    <p>Listen to Grammy-nominated tracks while you make your predictions!</p>
                    <button className="spotify-connect-button" onClick={onAuthRequired}>
                        <span className="spotify-icon">♫</span>
                        Connect Spotify
                    </button>
                </div>
            </div>
        );
    }

    // If not active, show transfer message
    if (!is_active) {
        return (
            <div className="spotify-player-wrapper">
                <div className="spotify-player inactive">
                    <p><b>Spotify player ready!</b></p>
                    <p>Transfer playback using your Spotify app to start listening.</p>
                </div>
            </div>
        );
    }

    // Active player
    return (
        <div className="spotify-player-wrapper">
            <div className="spotify-player">
                <div className="spotify-now-playing">
                    <img src={current_track?.album.images[0].url} className="spotify-cover" alt="Album cover" />
                    <div className="spotify-track-info">
                        <div className="spotify-track-name">{current_track?.name}</div>
                        <div className="spotify-artist-name">{current_track?.artists[0].name}</div>
                    </div>
                </div>

                <div className="spotify-controls">
                    <button className="spotify-btn" onClick={() => { player.previousTrack() }}>
                        ⏮
                    </button>

                    <button className="spotify-btn spotify-btn-play" onClick={() => { player.togglePlay() }}>
                        {is_paused ? "▶" : "⏸"}
                    </button>

                    <button className="spotify-btn" onClick={() => { player.nextTrack() }}>
                        ⏭
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SpotifyPlayer;
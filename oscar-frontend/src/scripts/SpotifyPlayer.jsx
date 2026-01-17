import React, { useState, useEffect } from 'react';

const SpotifyPlayer = ({ token, onAuthRequired, onTokenInvalid, playRequest }) => {
    const [player, setPlayer] = useState(undefined);
    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [current_track, setTrack] = useState(null);
    const [deviceId, setDeviceId] = useState(null);

    // New State for Sliders
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [isSeeking, setIsSeeking] = useState(false);

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
                setDuration(state.duration);

                // Sync position from state ONLY if not currently dragging slider
                if (!isSeeking) {
                    setPosition(state.position);
                }

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
    }, [token, onTokenInvalid, isSeeking]);

    // Local Timer to update slider smoothly between state updates
    useEffect(() => {
        let interval = null;
        if (is_active && !is_paused && !isSeeking) {
            interval = setInterval(() => {
                setPosition(prev => {
                    const next = prev + 500;
                    return next > duration ? duration : next;
                });
            }, 500); // Update every 500ms
        }
        return () => clearInterval(interval);
    }, [is_active, is_paused, isSeeking, duration]);


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
                    // player.togglePlay(); // Usually not needed if we sent a play command
                }
            };
            playTrack();
        }
    }, [playRequest, deviceId, token, player, onTokenInvalid]);

    // Handlers
    const handleSeekChange = (e) => {
        setPosition(Number(e.target.value));
    };

    const handleSeekStart = () => {
        setIsSeeking(true);
    };

    const handleSeekEnd = (e) => {
        const newPos = Number(e.target.value);
        setIsSeeking(false);
        if (player) {
            player.seek(newPos).then(() => {
                console.log(`Seeked to ${newPos} ms`);
            });
        }
    };

    const handleVolumeChange = (e) => {
        const newVol = Number(e.target.value);
        setVolume(newVol);
        if (player) {
            player.setVolume(newVol).then(() => {
                console.log('Volume updated!');
            });
        }
    };

    const formatTime = (ms) => {
        if (!ms) return "0:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

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
            <div className="spotify-player active-layout">
                <div className="spotify-main-row">
                    <div className="spotify-now-playing">
                        <img src={current_track?.album.images[0].url} className="spotify-cover" alt="Album cover" />
                        <div className="spotify-track-info">
                            <div className="spotify-track-name" title={current_track?.name}>{current_track?.name}</div>
                            <div className="spotify-artist-name" title={current_track?.artists[0].name}>{current_track?.artists[0].name}</div>
                        </div>
                    </div>

                    <div className="spotify-controls-container">
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

                    <div className="spotify-volume">
                        <span className="vol-icon">🔊</span>
                        <input
                            type="range"
                            className="volume-slider"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={handleVolumeChange}
                            style={{
                                '--seek-before-width': `${volume * 100}%`
                            }}
                        />
                    </div>
                </div>

                <div className="spotify-seek-row">
                    <span className="time-display">{formatTime(position)}</span>
                    <input
                        type="range"
                        className="seek-slider"
                        min="0"
                        max={duration || 0}
                        value={position}
                        onChange={handleSeekChange}
                        onMouseDown={handleSeekStart}
                        onMouseUp={handleSeekEnd}
                        onTouchStart={handleSeekStart}
                        onTouchEnd={handleSeekEnd}
                        style={{
                            '--seek-before-width': `${(position / (duration || 1)) * 100}%`
                        }}
                    />
                    <span className="time-display">{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}

export default SpotifyPlayer;
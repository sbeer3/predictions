import React, { useState, useEffect, useRef } from 'react';

const SpotifyPlayer = ({ token, onAuthRequired, onTokenInvalid, playRequest }) => {
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [isSeeking, setIsSeeking] = useState(false);

    const playerRef = useRef(null);

    // Initialize player - only depends on token
    useEffect(() => {
        if (!token) return;

        let mounted = true;

        const init = () => {
            const spotifyPlayer = new window.Spotify.Player({
                name: 'Grammy Predictions Player',
                getOAuthToken: cb => cb(token),
                volume: 0.5
            });

            playerRef.current = spotifyPlayer;

            spotifyPlayer.addListener('ready', ({ device_id }) => {
                if (!mounted) return;
                setDeviceId(device_id);
                setPlayer(spotifyPlayer);
                setIsReady(true);
            });

            spotifyPlayer.addListener('not_ready', () => {
                if (mounted) setIsReady(false);
            });

            spotifyPlayer.addListener('player_state_changed', state => {
                if (!state || !mounted) return;
                setCurrentTrack(state.track_window.current_track);
                setIsPaused(state.paused);
                setDuration(state.duration);
                if (!isSeeking) setPosition(state.position);
            });

            spotifyPlayer.addListener('authentication_error', () => onTokenInvalid?.());

            spotifyPlayer.connect();
        };

        // Load SDK if needed, then init
        if (window.Spotify) {
            init();
        } else {
            window.onSpotifyWebPlaybackSDKReady = init;
            if (!document.getElementById('spotify-sdk')) {
                const script = document.createElement('script');
                script.id = 'spotify-sdk';
                script.src = 'https://sdk.scdn.co/spotify-player.js';
                script.async = true;
                document.body.appendChild(script);
            }
        }

        return () => {
            mounted = false;
            playerRef.current?.disconnect();
        };
    }, [token]);

    // Handle play requests
    useEffect(() => {
        if (!playRequest?.uri || !deviceId || !token) return;

        const play = async () => {
            // Activate this device first
            await fetch('https://api.spotify.com/v1/me/player', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ device_ids: [deviceId], play: true })
            });

            // Small delay for activation
            await new Promise(r => setTimeout(r, 200));

            const body = playRequest.uri.includes(':track:')
                ? { uris: [playRequest.uri] }
                : { context_uri: playRequest.uri };

            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            // Resume after track loads
            setTimeout(() => playerRef.current?.resume(), 300);
        };

        play();
    }, [playRequest, deviceId, token]);

    // Position tracker
    useEffect(() => {
        if (isPaused || isSeeking || !isReady) return;
        const interval = setInterval(() => setPosition(p => Math.min(p + 1000, duration)), 1000);
        return () => clearInterval(interval);
    }, [isPaused, isSeeking, isReady, duration]);

    const formatTime = (ms) => {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    };

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

    if (!isReady || !currentTrack) {
        return (
            <div className="spotify-player-wrapper">
                <div className="spotify-player inactive">
                    <p><b>Spotify player {isReady ? 'ready' : 'initializing'}...</b></p>
                    <p>{isReady ? 'Click a song to start playing' : 'Please wait'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="spotify-player-wrapper">
            <div className="spotify-player active-layout">
                <div className="spotify-main-row">
                    <div className="spotify-now-playing">
                        <img src={currentTrack.album.images[0]?.url} className="spotify-cover" alt="Album cover" />
                        <div className="spotify-track-info">
                            <div className="spotify-track-name">{currentTrack.name}</div>
                            <div className="spotify-artist-name">{currentTrack.artists[0]?.name}</div>
                        </div>
                    </div>
                    <div className="spotify-controls-container">
                        <div className="spotify-controls">
                            <button className="spotify-btn" onClick={() => player?.previousTrack()}>⏮</button>
                            <button className="spotify-btn spotify-btn-play" onClick={() => player?.togglePlay()}>
                                {isPaused ? '▶' : '⏸'}
                            </button>
                            <button className="spotify-btn" onClick={() => player?.nextTrack()}>⏭</button>
                        </div>
                    </div>
                    <div className="spotify-volume">
                        <span className="vol-icon">🔊</span>
                        <input
                            type="range"
                            className="volume-slider"
                            min="0" max="1" step="0.01"
                            value={volume}
                            onChange={(e) => { setVolume(parseFloat(e.target.value)); player?.setVolume(parseFloat(e.target.value)); }}
                        />
                    </div>
                </div>
                <div className="spotify-seek-row">
                    <span className="time-display">{formatTime(position)}</span>
                    <input
                        type="range"
                        className="seek-slider"
                        min="0" max={duration} value={position}
                        onChange={(e) => setPosition(parseInt(e.target.value))}
                        onMouseDown={() => setIsSeeking(true)}
                        onMouseUp={(e) => player?.seek(parseInt(e.target.value)).then(() => setIsSeeking(false))}
                        onTouchStart={() => setIsSeeking(true)}
                        onTouchEnd={(e) => player?.seek(parseInt(e.target.value)).then(() => setIsSeeking(false))}
                    />
                    <span className="time-display">{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};

export default SpotifyPlayer;
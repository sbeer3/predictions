import React, { useState, useEffect } from 'react';

function GrammyLeaderboard({ currentUserName }) {
    const [players, setPlayers] = useState([]);
    const [totalCategories, setTotalCategories] = useState(0);
    const [winnersCount, setWinnersCount] = useState(0);
    const [eventStarted, setEventStarted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch predictions, categories, settings, and leaderboard in parallel
                const [predictionsRes, categoriesRes, settingsRes, leaderboardRes] = await Promise.all([
                    fetch('/api/grammy-predictions'),
                    fetch('/api/grammyBuilder'),
                    fetch('/api/grammy-admin/settings'),
                    fetch('/api/grammy-admin/leaderboard')
                ]);

                const predictions = await predictionsRes.json();
                const grammyData = await categoriesRes.json();
                const settings = await settingsRes.json();
                const leaderboardData = await leaderboardRes.json();

                setEventStarted(settings.eventStarted || false);
                setWinnersCount(leaderboardData.winnersCount || 0);

                // Count total categories
                let categoryCount = 0;
                if (grammyData.fields) {
                    grammyData.fields.forEach(field => {
                        categoryCount += field.categories.length;
                    });
                }
                setTotalCategories(categoryCount);

                // Transform data based on whether event has started
                let playerList;

                if (settings.eventStarted) {
                    // Event started - use scores from leaderboard
                    playerList = leaderboardData.leaderboard.map(player => ({
                        name: player.name,
                        score: player.score,
                        predictionsCount: player.totalPredictions
                    }));
                } else {
                    // Pre-event - show prediction counts
                    playerList = Object.entries(predictions).map(([username, data]) => ({
                        name: username,
                        score: 0,
                        predictionsCount: Object.keys(data.predictions || {}).length
                    }));

                    // Sort by predictions count (descending), then by name
                    playerList.sort((a, b) => {
                        if (b.predictionsCount !== a.predictionsCount) {
                            return b.predictionsCount - a.predictionsCount;
                        }
                        return a.name.localeCompare(b.name);
                    });
                }

                setPlayers(playerList);
            } catch (error) {
                console.error('Error loading leaderboard:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        // Refresh every 10 seconds during event, 30 seconds before
        const interval = setInterval(loadData, eventStarted ? 10000 : 30000);
        return () => clearInterval(interval);
    }, [eventStarted]);

    if (loading) {
        return (
            <div className="grammy-leaderboard">
                <div className="leaderboard-header">
                    <h3>🏆 {eventStarted ? 'Leaderboard' : 'Players'}</h3>
                </div>
                <div className="leaderboard-loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="grammy-leaderboard">
            <div className="leaderboard-header">
                <h3>🏆 {eventStarted ? 'Leaderboard' : 'Players'}</h3>
                <span className="player-count">
                    {eventStarted
                        ? `${winnersCount} winners announced`
                        : `${players.length} joined`
                    }
                </span>
            </div>

            {players.length === 0 ? (
                <div className="no-players">
                    No predictions yet. Be the first!
                </div>
            ) : (
                <div className="player-list">
                    {players.map((player, index) => {
                        const isCurrentUser = player.name === currentUserName;

                        // Different display for event started vs pre-event
                        const displayValue = eventStarted ? player.score : player.predictionsCount;
                        const displayMax = eventStarted ? winnersCount : totalCategories;
                        const progress = displayMax > 0
                            ? Math.round((displayValue / displayMax) * 100)
                            : 0;

                        return (
                            <div
                                key={player.name}
                                className={`player-row ${isCurrentUser ? 'current-user' : ''}`}
                            >
                                <div className="player-rank">
                                    {index === 0 && players.length > 1 ? '👑' : `#${index + 1}`}
                                </div>
                                <div className="player-info">
                                    <span className="player-name">
                                        {player.name}
                                        {isCurrentUser && <span className="you-badge">you</span>}
                                    </span>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="player-stats">
                                    {eventStarted ? (
                                        <>
                                            <span className="stat-number">{player.score}</span>
                                            <span className="stat-label"> pts</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="stat-number">{player.predictionsCount}</span>
                                            <span className="stat-label">/{totalCategories}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default GrammyLeaderboard;

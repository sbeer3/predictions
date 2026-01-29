import React, { useState, useEffect } from 'react';

function GrammyAdminPanel() {
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState({ isLocked: false, eventStarted: false });
    const [winners, setWinners] = useState({});
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedWinner, setSelectedWinner] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [categoriesRes, settingsRes, winnersRes] = await Promise.all([
                fetch('/api/grammyBuilder'),
                fetch('/api/grammy-admin/settings'),
                fetch('/api/grammy-admin/winners')
            ]);

            const categoriesData = await categoriesRes.json();
            const settingsData = await settingsRes.json();
            const winnersData = await winnersRes.json();

            // Flatten categories from fields
            const allCategories = [];
            if (categoriesData.fields) {
                categoriesData.fields.forEach(field => {
                    field.categories.forEach(cat => {
                        allCategories.push(cat);
                    });
                });
            }

            setCategories(allCategories);
            setSettings(settingsData);
            setWinners(winnersData);
        } catch (error) {
            console.error('Error loading admin data:', error);
            showMessage('Error loading data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(''), 3000);
    };

    const handleToggleLock = async () => {
        try {
            const res = await fetch('/api/grammy-admin/settings/toggle-lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLocked: !settings.isLocked })
            });
            const data = await res.json();
            setSettings(data.settings);
            showMessage(data.message);
        } catch (error) {
            showMessage('Error updating lock status', 'error');
        }
    };

    const handleToggleEvent = async () => {
        try {
            const res = await fetch('/api/grammy-admin/settings/toggle-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventStarted: !settings.eventStarted })
            });
            const data = await res.json();
            setSettings(data.settings);
            showMessage(data.message);
        } catch (error) {
            showMessage('Error updating event status', 'error');
        }
    };

    const handleSetWinner = async () => {
        if (!selectedCategory || !selectedWinner) {
            showMessage('Select a category and winner', 'error');
            return;
        }

        try {
            const res = await fetch('/api/grammy-admin/set-winner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId: selectedCategory,
                    winner: selectedWinner
                })
            });
            const data = await res.json();
            setWinners(data.winners);
            showMessage(`Winner set: ${selectedWinner}`);
            setSelectedCategory('');
            setSelectedWinner('');
        } catch (error) {
            showMessage('Error setting winner', 'error');
        }
    };

    const handleClearWinner = async (categoryId) => {
        try {
            const res = await fetch(`/api/grammy-admin/winner/${categoryId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            setWinners(data.winners);
            showMessage(data.message);
        } catch (error) {
            showMessage('Error clearing winner', 'error');
        }
    };

    const handleClearAllWinners = async () => {
        if (!window.confirm('Clear ALL winners? This cannot be undone.')) return;

        try {
            const res = await fetch('/api/grammy-admin/winners', {
                method: 'DELETE'
            });
            const data = await res.json();
            setWinners({});
            showMessage(data.message);
        } catch (error) {
            showMessage('Error clearing winners', 'error');
        }
    };

    const getCurrentCategory = () => {
        return categories.find(c => c.id === selectedCategory);
    };

    const getDisplayName = (nominee) => {
        if (nominee.work) {
            return `"${nominee.work}" - ${nominee.artist}`;
        }
        return nominee.artist;
    };

    if (loading) {
        return <div className="grammy-admin loading">Loading admin panel...</div>;
    }

    return (
        <div className="grammy-admin">
            <h2>🎵 Grammy Admin Panel</h2>

            {message && (
                <div className={`admin-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Settings Section */}
            <div className="admin-section">
                <h3>⚙️ Settings</h3>
                <div className="settings-grid">
                    <div className="setting-item">
                        <span className="setting-label">Predictions Locked</span>
                        <button
                            onClick={handleToggleLock}
                            className={`toggle-btn ${settings.isLocked ? 'active' : ''}`}
                        >
                            {settings.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                        </button>
                    </div>
                    <div className="setting-item">
                        <span className="setting-label">Event Started</span>
                        <button
                            onClick={handleToggleEvent}
                            className={`toggle-btn ${settings.eventStarted ? 'active' : ''}`}
                        >
                            {settings.eventStarted ? '🎤 Live!' : '⏳ Not Started'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Set Winner Section */}
            <div className="admin-section">
                <h3>🏆 Set Winner</h3>
                <div className="winner-form">
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedWinner('');
                        }}
                        className="admin-select"
                    >
                        <option value="">Select Category...</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name} {winners[cat.id] ? '✓' : ''}
                            </option>
                        ))}
                    </select>

                    {selectedCategory && getCurrentCategory() && (
                        <select
                            value={selectedWinner}
                            onChange={(e) => setSelectedWinner(e.target.value)}
                            className="admin-select"
                        >
                            <option value="">Select Winner...</option>
                            {getCurrentCategory().nominees.map((nom, idx) => (
                                <option key={idx} value={getDisplayName(nom)}>
                                    {getDisplayName(nom)}
                                </option>
                            ))}
                        </select>
                    )}

                    <button
                        onClick={handleSetWinner}
                        className="admin-btn primary"
                        disabled={!selectedCategory || !selectedWinner}
                    >
                        Set Winner
                    </button>
                </div>
            </div>

            {/* Winners List */}
            <div className="admin-section">
                <div className="section-header">
                    <h3>📋 Winners Set ({Object.keys(winners).length})</h3>
                    {Object.keys(winners).length > 0 && (
                        <button onClick={handleClearAllWinners} className="admin-btn danger small">
                            Clear All
                        </button>
                    )}
                </div>

                {Object.keys(winners).length === 0 ? (
                    <p className="empty-state">No winners set yet</p>
                ) : (
                    <div className="winners-list">
                        {Object.entries(winners).map(([categoryId, winner]) => {
                            const category = categories.find(c => c.id === categoryId);
                            return (
                                <div key={categoryId} className="winner-item">
                                    <div className="winner-info">
                                        <span className="winner-category">{category?.name || categoryId}</span>
                                        <span className="winner-name">{winner}</span>
                                    </div>
                                    <button
                                        onClick={() => handleClearWinner(categoryId)}
                                        className="clear-btn"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GrammyAdminPanel;

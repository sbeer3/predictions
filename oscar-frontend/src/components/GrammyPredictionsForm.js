import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles.css'; // Ensure we have access to shared styles

function GrammyPredictionsForm({ onSubmitPredictions, initialPredictions, isEditing, setPlayRequest, userName }) {
    const [eventData, setEventData] = useState(null);
    const [predictions, setPredictions] = useState(initialPredictions || {});
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error', ''
    const [grammySettings, setGrammySettings] = useState({ isLocked: false });
    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load categories and settings in parallel
                const [categoriesRes, settingsRes] = await Promise.all([
                    fetch('/api/grammyBuilder'),
                    fetch('/api/grammy-admin/settings')
                ]);

                const data = await categoriesRes.json();
                setEventData(data);

                if (settingsRes.ok) {
                    const settings = await settingsRes.json();
                    setGrammySettings(settings);
                }
            } catch (error) {
                console.error('Error loading grammy data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Load existing predictions for this user on mount
    useEffect(() => {
        const loadUserPredictions = async () => {
            if (!userName) return;

            try {
                const response = await fetch(`/api/grammy-predictions/user/${userName}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.predictions) {
                        setPredictions(data.predictions);
                    }
                }
            } catch (error) {
                console.log('No existing predictions found for user');
            }
        };

        loadUserPredictions();
    }, [userName]);

    useEffect(() => {
        if (initialPredictions) {
            setPredictions(initialPredictions);
        }
    }, [initialPredictions]);

    // Auto-save function with debouncing
    const autoSave = useCallback(async (categoryId, selection) => {
        if (!userName) {
            console.warn('No username provided - cannot save prediction');
            return;
        }

        setSaveStatus('saving');

        try {
            const response = await fetch('/api/grammy-predictions/autosave', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userName,
                    categoryId,
                    selection
                }),
            });

            if (response.ok) {
                setSaveStatus('saved');
                // Clear the "saved" message after 2 seconds
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }
                saveTimeoutRef.current = setTimeout(() => {
                    setSaveStatus('');
                }, 2000);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Error auto-saving prediction:', error);
            setSaveStatus('error');
        }
    }, [userName]);

    const handleSelectionChange = (categoryId, nomineeName) => {
        // Don't allow changes if predictions are locked
        if (grammySettings.isLocked) {
            return;
        }

        setPredictions(prev => ({
            ...prev,
            [categoryId]: nomineeName
        }));

        // Auto-save this selection
        autoSave(categoryId, nomineeName);
    };

    const isLocked = grammySettings.isLocked;

    if (loading) {
        return <div className="loading-spinner">Loading Nominees...</div>;
    }

    if (!eventData || !eventData.fields) {
        return <div className="error-message">Unable to load ballot data.</div>;
    }

    return (
        <div className="predictions-form">
            {/* Locked Banner */}
            {isLocked && (
                <div className="locked-banner">
                    🔒 Predictions are locked. You can view your picks but cannot make changes.
                </div>
            )}

            {/* Save Status Indicator */}
            {saveStatus && (
                <div className={`save-status-indicator ${saveStatus}`}>
                    {saveStatus === 'saving' && '💾 Saving...'}
                    {saveStatus === 'saved' && '✓ Saved!'}
                    {saveStatus === 'error' && '⚠ Save failed - will retry'}
                </div>
            )}

            {eventData.fields.map((field, fieldIdx) => (
                <div key={fieldIdx} className="field-section">
                    {field.categories.map((category) => (
                        <div key={category.id} className="category-group">
                            <h4 className="category-title">{category.name}</h4>

                            <div className="nominees-grid">
                                {category.nominees.map((nominee, nomIdx) => {
                                    const inputId = `cat-${category.id}-nom-${nomIdx}`;
                                    let displayName = nominee.artist;
                                    if (nominee.work) {
                                        displayName = `"${nominee.work}" - ${nominee.artist}`;
                                    }

                                    const isSelected = predictions[category.id] === displayName;

                                    return (
                                        <div key={nomIdx} className={`nominee-option ${isSelected ? 'selected' : ''}`}>
                                            <div
                                                className="nominee-image-container"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log("Play triggered for:", nominee.spotify_uri);
                                                    setPlayRequest({
                                                        uri: nominee.spotify_uri,
                                                        timestamp: Date.now()
                                                    });
                                                }}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <img className="nominee-image" src={nominee.spotify_image} alt={nominee.artist} />
                                                <div className="play-overlay">
                                                    <span className="play-icon">▶</span>
                                                </div>
                                            </div>
                                            <div className="nominee-info">
                                                <input
                                                    type="radio"
                                                    className="nominee-radio"
                                                    id={inputId}
                                                    name={`category-${category.id}`}
                                                    value={displayName}
                                                    checked={isSelected}
                                                    onChange={() => handleSelectionChange(category.id, displayName)}
                                                    disabled={isLocked}
                                                />
                                                <label htmlFor={inputId}>
                                                    <span className="nominee-name">{displayName}</span>
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {/* Submit button commented out - auto-save handles everything
            <div className="form-actions">
                <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting || (isEditing === false)}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Predictions'}
                </button>
            </div>
            */}
        </div>
    );
}

export default GrammyPredictionsForm;
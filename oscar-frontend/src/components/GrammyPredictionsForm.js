import React, { useState, useEffect } from 'react';
import '../styles.css'; // Ensure we have access to shared styles

function GrammyPredictionsForm({ onSubmitPredictions, initialPredictions, isEditing, setPlayRequest }) {
    const [eventData, setEventData] = useState(null);
    const [predictions, setPredictions] = useState(initialPredictions || {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('/api/grammyBuilder');
                const data = await response.json();
                setEventData(data);
            } catch (error) {
                console.error('Error loading grammy data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);
    useEffect(() => {
        if (initialPredictions) {
            setPredictions(initialPredictions);
        }
    }, [initialPredictions]);

    const handleSelectionChange = (categoryId, nomineeName) => {
        setPredictions(prev => ({
            ...prev,
            [categoryId]: nomineeName
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        onSubmitPredictions(predictions);
    };

    if (loading) {
        return <div className="loading-spinner">Loading Nominees...</div>;
    }

    if (!eventData || !eventData.fields) {
        return <div className="error-message">Unable to load ballot data.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="predictions-form">
            {/* <div className="event-header">
                <h2>{eventData.event}</h2>
                <p className="event-date">{new Date(eventData.date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
            </div> */}

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

            <div className="form-actions">
                {/* <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting || (isEditing === false)} // Disable if not editing allowed? Check logic
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Predictions'}
                </button> */}
            </div>
        </form>
    );
}

export default GrammyPredictionsForm;
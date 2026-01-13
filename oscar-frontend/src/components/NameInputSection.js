import React, { useState } from 'react';

function NameInputSection({ onNameSubmit }) {
    const [userName, setUserName] = useState('');
    const [isFormGrammysSubmitted, setIsFormGrammysSubmitted] = useState(false);
    const [isFormOscarsSubmitted, setIsFormOscarsSubmitted] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (userName.trim() !== "") {
            // Get which button was clicked (grammys or oscars)
            const selectedEvent = event.nativeEvent.submitter.value;
            if (selectedEvent === "grammys") {
                setIsFormGrammysSubmitted(true);
            } else {
                setIsFormOscarsSubmitted(true);
            }
            // Using setTimeout to show the welcome animation before proceeding
            setTimeout(() => {
                onNameSubmit(userName, selectedEvent);
            }, 800);
        } else {
            alert("Please enter your name to continue.");
        }
    };

    return (
        <div id="name-input-section" className={isFormGrammysSubmitted || isFormOscarsSubmitted ? "submitted" : ""}>
            <div className="welcome-container">
                <div className="hero-content">
                    <h1 className="app-title">Predictions Game</h1>
                    <p className="tagline">Compete with friends. Make your picks. Win bragging rights.</p>
                </div>

                <form onSubmit={handleSubmit} className="name-input-form">
                    <div className="input-container">
                        <input
                            type="text"
                            id="userName"
                            placeholder="Enter Your Name"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            disabled={isFormGrammysSubmitted || isFormOscarsSubmitted}
                        />
                        <label htmlFor="userName" className="floating-label">Enter Your Name</label>
                    </div>

                    <div className="event-selection-buttons">
                        <button
                            type="submit"
                            className="submit-name-button grammys-button"
                            value="grammys"
                            disabled={isFormGrammysSubmitted || isFormOscarsSubmitted}
                        >
                            <span className="button-icon">🎵</span>
                            {isFormGrammysSubmitted ? "Welcome..." : "Grammys Predictions"}
                        </button>
                        <button
                            type="submit"
                            className="submit-name-button oscars-button"
                            value="oscars"
                            disabled={isFormGrammysSubmitted || isFormOscarsSubmitted}
                        >
                            <span className="button-icon">🏆</span>
                            {isFormOscarsSubmitted ? "Welcome..." : "Oscars Predictions"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NameInputSection;
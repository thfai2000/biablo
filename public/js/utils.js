// Game utility functions

/**
 * Display a message in the game message area
 * @param {string} message - The message to display
 * @param {string} type - Type of message (info, warning, danger)
 */
function displayMessage(message, type = 'info') {
    const messageArea = document.getElementById('game-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.textContent = message;
    
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
    
    // Keep only the last 5 messages
    while (messageArea.children.length > 5) {
        messageArea.removeChild(messageArea.firstChild);
    }
}

/**
 * Fetch game configuration from server
 * @returns {Promise} - Promise containing game configuration
 */
async function fetchGameConfig() {
    try {
        const response = await fetch('/api/config');
        return await response.json();
    } catch (error) {
        console.error('Failed to load game configuration:', error);
        displayMessage('Failed to load game configuration.', 'danger');
        return null;
    }
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

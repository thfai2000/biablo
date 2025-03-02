import { GameConfig } from '../types/game-config';

/**
 * Fetches the game configuration from the server
 */
export async function fetchGameConfig(): Promise<GameConfig | null> {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json() as GameConfig;
  } catch (error) {
    console.error('Error fetching game config:', error);
    return null;
  }
}

/**
 * Display a message in the message log
 */
export function displayMessage(message: string, type: string = 'info'): void {
  const messageLog = document.getElementById('message-log');
  if (messageLog) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    messageElement.textContent = message;
    
    messageLog.appendChild(messageElement);
    
    // Scroll to the bottom
    messageLog.scrollTop = messageLog.scrollHeight;
    
    // Limit the number of messages
    while (messageLog.childElementCount > 50) {
      messageLog.removeChild(messageLog.firstChild as Node);
    }
  } else {
    console.log(`[${type}] ${message}`);
  }
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
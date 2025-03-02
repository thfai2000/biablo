import { GameConfig } from '../types/game-config';
import axios from 'axios';

/**
 * Fetches the game configuration
 * This is a mock implementation that returns a hardcoded config
 * instead of making an actual server request
 */
export async function fetchGameConfig(): Promise<GameConfig> {
  try {
    const response = await axios.get('/api/config');
    return response.data as GameConfig;
  } catch (error) {
    console.error('Error fetching game config:', error);
    throw error;
  }
}

/**
 * Displays a message to the user
 */
export function displayMessage(message: string, type: 'info' | 'success' | 'warning' | 'danger' = "info"): void {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create message element
  const messageElement = document.createElement('div');
  messageElement.className = `game-message ${type}`;
  messageElement.textContent = message;
  
  // Add to document
  const messageContainer = document.getElementById('game-messages');
  if (!messageContainer) {
    console.error('Message container not found');
    return;
  } else {
    // Add new message at the top
    messageContainer.insertBefore(messageElement, messageContainer.firstChild);
  }
  
  // Remove after delay
  setTimeout(() => {
    messageElement.style.opacity = '0';
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 500); // Wait for fade out animation
  }, 20000); // Show message for 5 seconds
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
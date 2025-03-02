/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;
/*!*****************************!*\
  !*** ./src/client/utils.ts ***!
  \*****************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchGameConfig = fetchGameConfig;
exports.displayMessage = displayMessage;
exports.randomInt = randomInt;
/**
 * Fetches the game configuration from the server
 */
async function fetchGameConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching game config:', error);
        return null;
    }
}
/**
 * Display a message in the message log
 */
function displayMessage(message, type = 'info') {
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
            messageLog.removeChild(messageLog.firstChild);
        }
    }
    else {
        console.log(`[${type}] ${message}`);
    }
}
/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

})();

/******/ })()
;
//# sourceMappingURL=utils.js.map
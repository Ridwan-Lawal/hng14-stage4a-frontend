/**
 * Message types used between popup, background, and content script.
 * Centralizing these prevents typos and makes refactoring easier.
 */
export const MessageType = {
  SUMMARIZE_REQUEST: 'SUMMARIZE_REQUEST',
  EXTRACT_CONTENT: 'EXTRACT_CONTENT',
};

/**
 * Send a message to the background service worker and await its response.
 * @param {object} message
 * @returns {Promise<any>}
 */
export function sendToBackground(message) {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send a message to a specific tab's content script and await its response.
 * @param {number} tabId
 * @param {object} message
 * @returns {Promise<any>}
 */
export function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}
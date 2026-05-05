// import { MessageType, sendToTab } from '../lib/messaging.js';
// import { getApiKey, getCachedSummary, setCachedSummary } from '../lib/storage.js';
// import { summarizeWithGemini } from '../lib/ai-client.js';

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message?.type !== MessageType.SUMMARIZE_REQUEST) return;

//   handleSummarize(message)
//     .then(sendResponse)
//     .catch((err) => {
//       console.error('[BG] Summarize failed:', err);
//       sendResponse({ ok: false, error: err.message });
//     });

//   return true;
// });

// async function handleSummarize({ forceRefresh = false } = {}) {
//   // 1. Get the active tab
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   if (!tab?.id) throw new Error('No active tab');
//   if (!/^https?:/.test(tab.url || '')) {
//     throw new Error('This page cannot be summarized.');
//   }

//   // 2. Cache check (skip if user forced refresh)
//   if (!forceRefresh) {
//     const cached = await getCachedSummary(tab.url);
//     if (cached) {
//       return { ok: true, summary: cached, fromCache: true };
//     }
//   }

//   // 3. Fail fast if no API key
//   const apiKey = await getApiKey();
//   if (!apiKey) {
//     throw new Error('No API key set. Open Settings to add one.');
//   }

//   // 4. Ask the content script for clean page content
//   const content = await sendToTab(tab.id, { type: MessageType.EXTRACT_CONTENT });
//   if (!content?.ok) {
//     throw new Error(content?.error || 'Failed to extract page content');
//   }

//   // 5. Send to Gemini
//   const summary = await summarizeWithGemini({
//     apiKey,
//     title: content.title,
//     text: content.text,
//     url: content.url,
//   });

//   // 6. Cache the result
//   await setCachedSummary(tab.url, summary);

//   return { ok: true, summary, fromCache: false };
// }

import { MessageType, sendToTab } from '../lib/messaging.js';
import { getCachedSummary, setCachedSummary } from '../lib/storage.js';
// Removed: import { getApiKey } from '../lib/storage.js';
// Removed: import { summarizeWithGemini } from '../lib/ai-client.js';

// Define your Vercel URL here (replace with your actual domain)
const PROXY_URL = 'https://ai-summarizer-proxy-seven.vercel.app/api/summarizer';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MessageType.SUMMARIZE_REQUEST) return;

  handleSummarize(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('[BG] Summarize failed:', err);
      sendResponse({ ok: false, error: err.message });
    });

  return true; // Keep message channel open for async response
});

async function handleSummarize({ forceRefresh = false } = {}) {
  // 1. Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (!/^https?:/.test(tab.url || '')) {
    throw new Error('This page cannot be summarized.');
  }

  // 2. Cache check
  if (!forceRefresh) {
    const cached = await getCachedSummary(tab.url);
    if (cached) {
      return { ok: true, summary: cached, fromCache: true };
    }
  }

  // Note: API Key check was removed here! The backend handles it now.

  // 3. Ask the content script for clean page content
  const content = await sendToTab(tab.id, { type: MessageType.EXTRACT_CONTENT });
  if (!content?.ok) {
    throw new Error(content?.error || 'Failed to extract page content');
  }

  // 4. Send the extracted data to your Vercel Proxy
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: content.title,
      content: content.text,
      url: content.url,
    }),
  });

  // 5. Handle Proxy/Server Errors Gracefully
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status: ${response.status}`);
  }

  // 6. Extract the summary from the proxy response
  const proxyData = await response.json();
  
  if (!proxyData.summary) {
     throw new Error('Invalid response format from proxy server.');
  }

  // 7. Cache the successful result
  await setCachedSummary(tab.url, proxyData.summary);

  return { ok: true, summary: proxyData.summary, fromCache: false };
}
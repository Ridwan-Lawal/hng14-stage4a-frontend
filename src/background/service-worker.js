import { MessageType, sendToTab } from '../lib/messaging.js';
import { getApiKey, getCachedSummary, setCachedSummary } from '../lib/storage.js';
import { summarizeWithGemini } from '../lib/ai-client.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MessageType.SUMMARIZE_REQUEST) return;

  handleSummarize(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('[BG] Summarize failed:', err);
      sendResponse({ ok: false, error: err.message });
    });

  return true;
});

async function handleSummarize({ forceRefresh = false } = {}) {
  // 1. Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (!/^https?:/.test(tab.url || '')) {
    throw new Error('This page cannot be summarized.');
  }

  // 2. Cache check (skip if user forced refresh)
  if (!forceRefresh) {
    const cached = await getCachedSummary(tab.url);
    if (cached) {
      return { ok: true, summary: cached, fromCache: true };
    }
  }

  // 3. Fail fast if no API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('No API key set. Open Settings to add one.');
  }

  // 4. Ask the content script for clean page content
  const content = await sendToTab(tab.id, { type: MessageType.EXTRACT_CONTENT });
  if (!content?.ok) {
    throw new Error(content?.error || 'Failed to extract page content');
  }

  // 5. Send to Gemini
  const summary = await summarizeWithGemini({
    apiKey,
    title: content.title,
    text: content.text,
    url: content.url,
  });

  // 6. Cache the result
  await setCachedSummary(tab.url, summary);

  return { ok: true, summary, fromCache: false };
}
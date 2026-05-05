import { MessageType, sendToBackground } from '../lib/messaging.js';

const titleEl = document.getElementById('page-title');
const summarizeBtn = document.getElementById('summarize-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const copyBtn = document.getElementById('copy-btn');

let currentSummary = null;

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    titleEl.textContent = tab?.title || 'Untitled page';
    titleEl.title = tab?.title || '';
  } catch {
    titleEl.textContent = 'Unable to read page';
  }
}

async function handleSummarize() {
  setLoading(true);
  setSummary('');

  try {
    const response = await sendToBackground({
      type: MessageType.SUMMARIZE_REQUEST,
    });

    if (!response?.ok) throw new Error(response?.error || 'Unknown error');

    setStatus(response.fromCache ? 'Cached result' : '');
    renderSummary(response.summary);
    currentSummary = response.summary;
copyBtn.hidden = false;
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function handleClear() {
  setStatus('');
  setSummary('');
  copyBtn.hidden = true;
currentSummary = null;
}

function setLoading(isLoading) {
  summarizeBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;
  if (isLoading) {
    statusEl.innerHTML = '<span class="spinner"></span>Summarizing…';
    statusEl.classList.remove('error');
  }
}

function setStatus(message, variant = '') {
  statusEl.classList.toggle('error', variant === 'error');
  // If error mentions Settings, make the word a clickable link
  if (variant === 'error' && message.includes('Settings')) {
    const safe = escapeHtml(message).replace(
      'Settings',
      '<a href="#" id="open-settings">Settings</a>'
    );
    statusEl.innerHTML = safe;
    document.getElementById('open-settings')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  } else {
    statusEl.textContent = message;
  }
}

function setSummary(html) {
  summaryEl.innerHTML = html;
}


function renderSummary({ bullets, insights, readingTimeMinutes }) {
  const parts = [];

  if (readingTimeMinutes) {
    parts.push(`<div class="meta">⏱ Estimated ${readingTimeMinutes} min read</div>`);
  }

  if (bullets?.length) {
    parts.push('<h3>Summary</h3><ul>');
    for (const b of bullets) parts.push(`<li>${escapeHtml(b)}</li>`);
    parts.push('</ul>');
  }

  if (insights?.length) {
    parts.push('<h3>Key insights</h3><ul>');
    for (const i of insights) parts.push(`<li>${escapeHtml(i)}</li>`);
    parts.push('</ul>');
  }

  summaryEl.innerHTML = parts.join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

summarizeBtn.addEventListener('click', handleSummarize);
clearBtn.addEventListener('click', handleClear);
document.getElementById('options-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
copyBtn.addEventListener('click', async () => {
  if (!currentSummary) return;
  const text = formatSummaryAsText(currentSummary);
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => { copyBtn.textContent = original; }, 1500);
  } catch {
    setStatus('Could not copy to clipboard', 'error');
  }
});

function formatSummaryAsText({ bullets, insights, readingTimeMinutes }) {
  const lines = [];
  if (readingTimeMinutes) lines.push(`Estimated ${readingTimeMinutes} min read`, '');
  if (bullets?.length) {
    lines.push('Summary:');
    for (const b of bullets) lines.push(`• ${b}`);
    lines.push('');
  }
  if (insights?.length) {
    lines.push('Key insights:');
    for (const i of insights) lines.push(`• ${i}`);
  }
  return lines.join('\n').trim();
}

init();

function showInitialState() {
  if (!summaryEl.innerHTML) {
    setStatus('Click Summarize Page to begin');
  }
}
showInitialState();
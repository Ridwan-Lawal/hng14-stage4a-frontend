import { clearApiKey, getApiKey, setApiKey } from '../lib/storage.js';

const apiKeyInput = document.getElementById('api-key');
const toggleBtn = document.getElementById('toggle-visibility');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');

async function init() {
  const key = await getApiKey();
  if (key) apiKeyInput.value = key;
}

function setStatus(message, variant = '') {
  statusEl.textContent = message;
  statusEl.classList.remove('success', 'error');
  if (variant) statusEl.classList.add(variant);

  if (variant === 'success') {
    setTimeout(() => {
      if (statusEl.textContent === message) setStatus('');
    }, 3000);
  }
}

function validateKey(key) {
  if (!key) return 'API key cannot be empty';
  if (!key.startsWith('AIza')) return 'Gemini API keys start with "AIza"';
  if (key.length < 30) return 'API key looks too short';
  return null;
}

async function handleSave() {
  const key = apiKeyInput.value.trim();
  const error = validateKey(key);
  if (error) {
    setStatus(error, 'error');
    return;
  }

  try {
    await setApiKey(key);
    setStatus('Saved.', 'success');
  } catch (err) {
    setStatus('Failed to save: ' + err.message, 'error');
  }
}

async function handleClear() {
  if (!confirm('Remove the saved API key?')) return;
  try {
    await clearApiKey();
    apiKeyInput.value = '';
    setStatus('Key cleared.', 'success');
  } catch (err) {
    setStatus('Failed to clear: ' + err.message, 'error');
  }
}

function handleToggleVisibility() {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide key' : 'Show key');
}

saveBtn.addEventListener('click', handleSave);
clearBtn.addEventListener('click', handleClear);
toggleBtn.addEventListener('click', handleToggleVisibility);

init();
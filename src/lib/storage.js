
const KEYS = {
  API_KEY: 'gemini_api_key',
  CACHE_PREFIX: 'summary_cache:',
};


export async function getApiKey() {
  const result = await chrome.storage.local.get(KEYS.API_KEY);
  return result[KEYS.API_KEY] || '';
}

export async function setApiKey(key) {
  await chrome.storage.local.set({ [KEYS.API_KEY]: key });
}

export async function clearApiKey() {
  await chrome.storage.local.remove(KEYS.API_KEY);
}



function cacheKeyFor(url) {
  return KEYS.CACHE_PREFIX + url;
}

export async function getCachedSummary(url) {
  const key = cacheKeyFor(url);
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry) return null;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - entry.timestamp > ONE_DAY_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry.summary;
}

export async function setCachedSummary(url, summary) {
  const key = cacheKeyFor(url);
  await chrome.storage.local.set({
    [key]: { summary, timestamp: Date.now() },
  });
}

export async function clearAllCache() {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((k) => k.startsWith(KEYS.CACHE_PREFIX));
  if (cacheKeys.length) {
    await chrome.storage.local.remove(cacheKeys);
  }
}
import { Readability, isProbablyReaderable } from '@mozilla/readability';

(() => {
  // Guard against double-injection on the same page
  if (window.__aiSummarizerInjected) return;
  window.__aiSummarizerInjected = true;

  const EXTRACT_CONTENT = 'EXTRACT_CONTENT';
  const MAX_CHARS = 12000; // Hard cap on what we send to the AI

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== EXTRACT_CONTENT) return;

    try {
      const content = extractContent();
      sendResponse({ ok: true, ...content });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }

    // return true
   
  });

  function extractContent() {
    const url = location.href;
    const fallbackTitle = document.title;

    // Readability MUTATES the DOM it's given — always pass a clone
    const docClone = document.cloneNode(true);
    const looksLikeArticle = isProbablyReaderable(document);

    const reader = new Readability(docClone);
    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 200) {
      return {
        title: article.title || fallbackTitle,
        text: truncate(article.textContent.trim(), MAX_CHARS),
        excerpt: article.excerpt || '',
        byline: article.byline || '',
        url,
        extractionMethod: 'readability',
        looksLikeArticle,
      };
    }

    // Fallback for non-article pages: try main/article elements, then body
    return {
      title: fallbackTitle,
      text: truncate(heuristicExtract(), MAX_CHARS),
      excerpt: '',
      byline: '',
      url,
      extractionMethod: 'fallback',
      looksLikeArticle,
    };
  }

  function heuristicExtract() {
    const candidates = [
      document.querySelector('main'),
      document.querySelector('article'),
      document.querySelector('[role="main"]'),
      document.body,
    ].filter(Boolean);

    for (const el of candidates) {
      const text = el.innerText?.trim();
      if (text && text.length > 200) return text;
    }

    return document.body?.innerText?.trim() || '';
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    const slice = text.slice(0, max);
    const lastSpace = slice.lastIndexOf(' ');
    return slice.slice(0, lastSpace > max - 200 ? lastSpace : max) + '…';
  }
})();
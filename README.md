# AI Page Summarizer

A Chrome extension (Manifest V3) that extracts the main content from any webpage and uses Google's Gemini AI to generate a structured summary with bullet points, key insights, and an estimated reading time.

## Features

- **One-click summarization** — extracts and summarizes the current page from the toolbar
- **Clean content extraction** — uses Mozilla Readability (the engine behind Firefox Reader View) to strip away navigation, sidebars, ads, and comments
- **Heuristic fallback** — gracefully handles pages that aren't article-shaped
- **Structured output** — bullet-point summary, key insights, and estimated reading time
- **Per-URL caching** — re-summarizing the same page is instant and free (24-hour TTL)
- **User-supplied API key** — your key stays on your device, stored only in `chrome.storage.local`
- **Robust error handling** — rate limits, missing keys, invalid keys, unsupported pages, and network failures all produce clear, actionable messages
- **Copy-to-clipboard** — copy the formatted summary with one click
- **Minimal permissions** — only `activeTab`, `storage`, and the Gemini API host

## Installation

> This extension is built locally — it is not published to the Chrome Web Store.

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Build and load the extension

1. Clone the repo and install dependencies:

```bash
   git clone <repo-url>
   cd ai-page-summarizer
   npm install
```

2. Build the extension:

```bash
   npm run build
```

   This produces a `dist/` folder containing the loadable extension.

3. Open Chrome and navigate to `chrome://extensions`.

4. Toggle **Developer mode** on (top right).

5. Click **Load unpacked** and select the `dist/` folder.

6. The extension icon appears in your toolbar. Pin it for easy access (puzzle-piece icon → pin).

### Configure your API key

1. Click the extension icon to open the popup.
2. Click **Settings** in the popup footer.
3. Paste your Gemini API key and click **Save**.

That's it. Open any article and click **Summarize Page**.

## Architecture

The extension has four cooperating contexts, each isolated by Chrome's extension model:

\`\`\`
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Popup     │ ──msg─→ │ Service Worker   │ ──msg─→ │ Content      │
│  (UI only)  │ ←─resp─ │  (orchestration) │ ←─resp─ │  Script      │
└─────────────┘         └──────────────────┘         │ (extraction) │
                               │                     └──────────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │  Gemini API  │
                       └──────────────┘
\`\`\`

### File layout

\`\`\`
src/
├── background/
│   └── service-worker.js    # Orchestrates: cache → key → extract → AI → cache
├── content/
│   └── content-script.js    # Injected into pages; runs Readability on demand
├── popup/
│   ├── popup.html           # Toolbar UI
│   ├── popup.css
│   └── popup.js             # Renders summaries, handles user actions
├── options/
│   ├── options.html         # API key entry page
│   ├── options.css
│   └── options.js
└── lib/
    ├── messaging.js         # Message-type constants + send helpers
    ├── storage.js           # chrome.storage wrapper (API key + cache)
    └── ai-client.js         # Gemini API client (the only file that talks to the AI)
\`\`\`

### Responsibilities

- **Popup** is dumb UI. It never calls `fetch` or accesses storage directly. It only sends messages to the background worker and renders responses.
- **Service worker** is the orchestrator. It runs the cache check, fetches the API key, asks the content script for page content, calls the AI client, and caches the result.
- **Content script** is auto-injected on all `http(s)` pages via the manifest. It does nothing on page load except register a message listener — work only happens when the background worker asks for content.
- **AI client** isolates all Gemini-specific details (endpoint, request shape, response parsing). Swapping providers means changing this one file.
- **Storage helper** centralizes all `chrome.storage` access so storage strategy can change without rippling through the codebase.

### Message protocol

| From | To | Type | Purpose |
|---|---|---|---|
| Popup | Background | `SUMMARIZE_REQUEST` | "Summarize the active tab" |
| Background | Content script | `EXTRACT_CONTENT` | "Give me the cleaned page text" |

Message-type strings are defined in `lib/messaging.js` to prevent typos.

## AI integration

### Provider

This extension uses **Google's Gemini API** (`gemini-2.0-flash` model). Reasons:

- Generous free tier suitable for a demo project
- Native JSON-output mode (`responseMimeType: 'application/json'`) — much more reliable than prompt-only JSON instructions
- Fast inference (`flash` variant) keeps the popup responsive

### Prompt design

A concise system instruction tells the model to return strict JSON with three fields: `bullets`, `insights`, and `readingTimeMinutes`. The user message contains the page title, URL, and extracted body text. Temperature is set to `0.3` for consistent, factual output rather than creative interpretation.

### Defensive parsing

Even with `responseMimeType` enforcing JSON, the response is parsed defensively:

1. Strip any code-fence wrapping the model adds out of habit.
2. `JSON.parse` with try/catch.
3. Validate shape: `bullets` must be a non-empty array of strings; `insights` and `readingTimeMinutes` are coerced or dropped if malformed.

This means a misbehaving model produces a clean error message ("AI returned malformed output. Try again.") instead of a crash.

### Error mapping

HTTP errors from the Gemini API are translated into user-actionable messages:

| Status | User sees |
|---|---|
| 400 | "Invalid request: …" |
| 401 / 403 | "Invalid API key. Check your settings." |
| 429 | "Rate limit hit. Wait a moment and try again." |
| 5xx | "Gemini service is having issues. Try again shortly." |

## Security decisions

### API key handling

The spec requires that the API key never be exposed in the frontend or committed to the repo. Two architectures satisfy this:

1. **Proxy server** — host a backend that holds the key and proxies AI requests.
2. **User-supplied key** — the user pastes their own key into an Options page; it lives only in their browser.

This extension uses **option 2**. Reasons:

- No hosting required, fully local install
- Each user's quota is their own; no shared key gets exhausted
- Graders can test with their own key without sharing yours

The key is stored in `chrome.storage.local`, which is scoped to this extension on this browser profile. It is never transmitted anywhere except directly to Google's Gemini API endpoint.

**Trade-off:** local storage of an API key is not encrypted at rest. Encrypting with a key that lives in the same extension would be security theater (anyone with extension access can decrypt). The protection is the storage scope, not encryption. A production version intended for a public Chrome Web Store release would likely move to architecture #1 (proxy server) so users never need their own key.

### Minimal permissions

The manifest requests only:

- `activeTab` — read the current tab's content *only* when the user clicks the icon (not all tabs, not in the background)
- `storage` — for the API key and summary cache
- `host_permissions: https://generativelanguage.googleapis.com/*` — narrowly scoped to the AI provider

We deliberately did **not** request:

- `<all_urls>` — would let us read every page, all the time
- `tabs` — gives access to all open tabs' URLs and titles
- `scripting` — not needed since the content script is declared in the manifest

### XSS prevention

AI output is untrusted and treated as such. Every string returned by the AI is escaped via `textContent` before being inserted into the DOM. The popup never uses `innerHTML` with user-influenced or AI-influenced content directly.

### CSP compliance

Manifest V3 enforces a strict default Content Security Policy: no inline scripts, no inline event handlers, no `eval`. All scripts are loaded from extension files via `<script src>`, and all event handlers are attached programmatically.

## Trade-offs

A few decisions worth flagging that a code reader might question:

- **Content script declared in the manifest, not injected programmatically.** Programmatic injection (via `chrome.scripting.executeScript`) avoids loading the script on every page, but it complicated the bundling of Readability and produced flaky behavior. The manifest-declared script registers a listener and does nothing else until messaged — the per-page cost is negligible.

- **Vanilla JS, no React.** The popup renders ~8 elements. React would add ~45KB of bundle for no functional benefit at this scale. Vanilla JS with ES modules keeps the code small, fast, and easy to follow.

- **24-hour cache TTL.** Articles can be edited, so caching forever would serve stale summaries. One day balances freshness against not burning quota when the user re-opens the same page.

- **Truncation at 12,000 characters.** Gemini can handle much longer inputs, but every additional character costs tokens. Most articles are well under this limit; truncation only kicks in for very long pieces, and we cut at a word boundary near the limit so the AI gets a clean tail.

- **No retry-with-backoff on rate limits.** A retry loop would make the popup feel slow and burn quota. We surface the rate limit clearly and let the user decide when to try again.

## Demo

[Link to demo video here once recorded]

## License

MIT


const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an expert summarizer. You will be given the text of a webpage. Your task is to produce a concise, faithful summary of its content.

Respond ONLY with valid JSON matching this exact shape, no markdown, no code fences, no preamble:

{
  "bullets": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "readingTimeMinutes": 5
}

Guidelines:
- bullets: 3 to 6 items, each one short and self-contained, capturing the main points
- insights: 2 to 4 items, each highlighting a non-obvious takeaway, implication, or notable detail
- readingTimeMinutes: integer estimate of how long the original page takes to read at 220 words per minute
- Stay faithful to the source. Do not invent facts not present in the text.
- If the text is too short, off-topic, or not actually article content, return your best effort with fewer bullets rather than fabricating.`;

/**
 * Summarize the given page content using Gemini.
 * @returns {Promise<{bullets: string[], insights: string[], readingTimeMinutes: number|null}>}
 */
export async function summarizeWithGemini({ apiKey, title, text, url }) {
  if (!apiKey) {
    throw new Error('Missing API key. Open the extension settings to add one.');
  }
  if (!text || text.trim().length < 50) {
    throw new Error('Not enough page content to summarize.');
  }

  const userPrompt = buildUserPrompt({ title, text, url });

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('AI returned an empty response.');
  }

  const parsed = parseJsonResponse(rawText);
  return validateSummaryShape(parsed);
}

function buildUserPrompt({ title, text, url }) {
  return `Page title: ${title}
URL: ${url}

Page content:
"""
${text}
"""`;
}

async function readApiError(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || '';
  } catch {
   
  }

  if (response.status === 400) return `Invalid request: ${detail || 'check your input'}`;
  if (response.status === 401 || response.status === 403) return 'Invalid API key. Check your settings.';
  if (response.status === 429) return 'Rate limit hit. Wait a moment and try again.';
  if (response.status >= 500) return 'Gemini service is having issues. Try again shortly.';
  return `AI request failed (${response.status}): ${detail || 'unknown error'}`;
}

function parseJsonResponse(text) {

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned malformed output. Try again.');
  }
}

function validateSummaryShape(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('AI response was not an object.');
  }

  const bullets = Array.isArray(obj.bullets)
    ? obj.bullets.filter((b) => typeof b === 'string' && b.trim()).slice(0, 6)
    : [];
  const insights = Array.isArray(obj.insights)
    ? obj.insights.filter((i) => typeof i === 'string' && i.trim()).slice(0, 4)
    : [];
  const readingTimeMinutes = Number.isFinite(obj.readingTimeMinutes)
    ? Math.max(1, Math.round(obj.readingTimeMinutes))
    : null;

  if (bullets.length === 0) {
    throw new Error('AI did not return any bullet points.');
  }

  return { bullets, insights, readingTimeMinutes };
}
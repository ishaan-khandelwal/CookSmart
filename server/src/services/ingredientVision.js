// Ingredient detection from images.
//
// Gnani Vision is the primary provider. Gnani does not publish a public vision
// API yet, so the adapter is driven entirely by env vars (endpoint, auth header,
// request format) and accepts the common detection response shapes. Gemini
// vision is the fallback so scanning keeps working until Gnani access is set up.

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_MIN_CONFIDENCE = 0.3;
const REQUEST_TIMEOUT_MS = 25000;

const INGREDIENT_PROMPT = `You are a food ingredient detector for a cooking app.
Identify every distinct food ingredient visible in the image: vegetables, fruits, spices, herbs, grains, dairy, meat, eggs, packaged pantry items.
Use short, common lowercase English names (e.g. "tomato", "green chilli", "paneer", "basmati rice").
Give each ingredient a confidence between 0 and 1 for how sure you are it is present.
Ignore utensils, packaging text, people and non-food objects. Return an empty array if no food is visible.`;

const GEMINI_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      confidence: { type: 'NUMBER' },
    },
    required: ['name', 'confidence'],
  },
};

// Keys Gnani (or any detection API) might use for the list and for each item.
const LIST_KEYS = ['ingredients', 'detections', 'predictions', 'objects', 'labels', 'results', 'items'];
const NAME_KEYS = ['name', 'label', 'ingredient', 'class', 'class_name', 'className', 'description'];
const CONFIDENCE_KEYS = ['confidence', 'score', 'probability', 'prob'];

function readEnv(key) {
  return String(process.env[key] || '').trim().replace(/^['"]|['"]$/g, '');
}

function getMinConfidence() {
  const rawValue = readEnv('SCAN_MIN_CONFIDENCE');
  const value = Number(rawValue);
  return rawValue && Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_MIN_CONFIDENCE;
}

function getGnaniVisionConfig() {
  return {
    url: readEnv('GNANI_VISION_URL'),
    apiKey: readEnv('GNANI_VISION_API_KEY') || readEnv('GNANI_API_KEY'),
    authHeader: readEnv('GNANI_VISION_AUTH_HEADER') || 'X-API-Key-ID',
    requestFormat: readEnv('GNANI_VISION_REQUEST_FORMAT') === 'multipart' ? 'multipart' : 'json',
    imageField: readEnv('GNANI_VISION_IMAGE_FIELD') || 'image',
  };
}

function getGeminiConfig() {
  return {
    apiKey: readEnv('GEMINI_API_KEY'),
    model: readEnv('GEMINI_VISION_MODEL') || DEFAULT_GEMINI_MODEL,
  };
}

export function getConfiguredVisionProviders() {
  const providers = [];
  const gnani = getGnaniVisionConfig();
  const gemini = getGeminiConfig();

  if (gnani.url && gnani.apiKey) providers.push('gnani');
  if (gemini.apiKey) providers.push('gemini');

  return providers;
}

function createScanError(message, { code = 'API_ERROR', status, provider } = {}) {
  return Object.assign(new Error(message), { code, status, provider });
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Some providers (Gemini included) echo the API key back in error messages.
async function readErrorDetail(response, apiKey) {
  const text = await response.text().catch(() => '');
  let detail = text;

  try {
    const payload = JSON.parse(text);
    detail = payload?.error?.message || payload?.message || payload?.detail || text;
  } catch {
    // Non-JSON error body; use it as-is.
  }

  return apiKey ? String(detail).split(apiKey).join('[redacted]') : String(detail);
}

function errorCodeForStatus(status) {
  return status === 401 || status === 403 ? 'AUTH_ERROR' : 'API_ERROR';
}

function pickFirst(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function findDetectionList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;

  const directList = pickFirst(payload, LIST_KEYS);
  if (Array.isArray(directList)) return directList;

  // Some APIs wrap results one level deeper, e.g. { data: { detections: [...] } }.
  for (const wrapperKey of ['data', 'result', 'output', 'response']) {
    const nested = findDetectionList(payload[wrapperKey]);
    if (nested) return nested;
  }

  return null;
}

function toConfidence(value) {
  const number = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(number)) {
    return null;
  }

  // Accept both 0-1 and 0-100 scales.
  const scaled = number > 1 && number <= 100 ? number / 100 : number;
  return Math.min(1, Math.max(0, Math.round(scaled * 100) / 100));
}

export function normalizeDetections(rawList) {
  const minConfidence = getMinConfidence();
  const byName = new Map();

  (Array.isArray(rawList) ? rawList : []).forEach((item) => {
    const rawName = typeof item === 'string' ? item : pickFirst(item, NAME_KEYS);
    const name = String(rawName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const confidence = typeof item === 'string' ? null : toConfidence(pickFirst(item, CONFIDENCE_KEYS));

    if (!name || (confidence !== null && confidence < minConfidence)) {
      return;
    }

    const existing = byName.get(name);
    if (!existing || (confidence ?? 0) > (existing.confidence ?? 0)) {
      byName.set(name, { name, confidence });
    }
  });

  return Array.from(byName.values()).sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0));
}

async function detectWithGnani(imageBase64, mimeType) {
  const config = getGnaniVisionConfig();
  let body;
  const headers = { [config.authHeader]: config.apiKey };

  if (config.requestFormat === 'multipart') {
    body = new FormData();
    body.append(
      config.imageField,
      new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }),
      `scan.${mimeType.split('/')[1] || 'jpg'}`,
    );
    body.append('task', 'food_ingredient_detection');
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      [config.imageField]: imageBase64,
      mime_type: mimeType,
      task: 'food_ingredient_detection',
    });
  }

  let response;
  try {
    response = await fetchWithTimeout(config.url, { method: 'POST', headers, body });
  } catch (error) {
    throw createScanError(`Gnani Vision request failed: ${error.message}`, { code: 'NETWORK_ERROR', provider: 'gnani' });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response, config.apiKey);
    throw createScanError(detail || `Gnani Vision returned ${response.status}`, {
      code: errorCodeForStatus(response.status),
      status: response.status,
      provider: 'gnani',
    });
  }

  const payload = await response.json().catch(() => null);
  const list = findDetectionList(payload);

  if (!list) {
    throw createScanError('Gnani Vision response did not contain a detection list.', {
      code: 'INVALID_RESPONSE',
      provider: 'gnani',
    });
  }

  return normalizeDetections(list);
}

async function detectWithGemini(imageBase64, mimeType) {
  const { apiKey, model } = getGeminiConfig();
  const generationConfig = {
    temperature: 0.1,
    responseMimeType: 'application/json',
    responseSchema: GEMINI_RESPONSE_SCHEMA,
  };

  // Flash models think by default; skipping it roughly halves scan latency.
  if (/flash/i.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let response;
  try {
    response = await fetchWithTimeout(`${GEMINI_API_ROOT}/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: INGREDIENT_PROMPT },
            ],
          },
        ],
        generationConfig,
      }),
    });
  } catch (error) {
    throw createScanError(`Gemini request failed: ${error.message}`, { code: 'NETWORK_ERROR', provider: 'gemini' });
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response, apiKey);
    throw createScanError(detail || `Gemini returned ${response.status}`, {
      code: errorCodeForStatus(response.status),
      status: response.status,
      provider: 'gemini',
    });
  }

  const payload = await response.json().catch(() => null);
  const text = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  try {
    return normalizeDetections(JSON.parse(text));
  } catch {
    throw createScanError('Gemini returned an unreadable ingredient list.', {
      code: 'INVALID_RESPONSE',
      provider: 'gemini',
    });
  }
}

const DETECTORS = {
  gnani: detectWithGnani,
  gemini: detectWithGemini,
};

export async function detectIngredientsInImage({ imageBase64, mimeType }) {
  const providers = getConfiguredVisionProviders();

  if (!providers.length) {
    throw createScanError(
      'No vision provider is configured. Set GNANI_VISION_URL + GNANI_API_KEY (or GEMINI_API_KEY) in server/.env.',
      { code: 'MISSING_API_KEY' },
    );
  }

  const failures = [];

  for (const provider of providers) {
    try {
      const ingredients = await DETECTORS[provider](imageBase64, mimeType);
      return {
        provider,
        ingredients,
        fallbackFrom: failures.map((failure) => failure.provider),
      };
    } catch (error) {
      console.warn(`[scan] ${provider} failed: ${error.status || ''} ${error.message}`);
      failures.push(error);
    }
  }

  // Surface the primary provider's error; it is the one the user configured first.
  throw failures[0];
}

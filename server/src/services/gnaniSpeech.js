// Gnani Prisma speech-to-text: https://docs.gnani.ai/api/STT/speech-to-text
// Used for "say your ingredients" voice input on the ingredient review screen.

import { extractIngredientsFromTranscript } from './ingredientParser.js';

const DEFAULT_STT_URL = 'https://api.vachana.ai/stt/v3';
const DEFAULT_LANGUAGE = 'en-IN';
const REQUEST_TIMEOUT_MS = 30000;

const SUPPORTED_LANGUAGES = new Set([
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN',
]);

// Gnani accepts WAV, MP3, OGG, FLAC, AAC and M4A.
const AUDIO_EXTENSIONS = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
};

// Boosts kitchen vocabulary. Gnani allows up to 100 single words, letters only.
const INGREDIENT_BIAS_WORDS = [
  'tomato', 'onion', 'potato', 'garlic', 'ginger', 'paneer', 'chicken', 'mutton', 'egg', 'eggs',
  'rice', 'dal', 'atta', 'besan', 'maida', 'spinach', 'palak', 'capsicum', 'carrot', 'cauliflower',
  'cabbage', 'peas', 'brinjal', 'okra', 'bhindi', 'mushroom', 'cucumber', 'beetroot', 'radish', 'pumpkin',
  'coriander', 'mint', 'curry', 'chilli', 'lemon', 'curd', 'yogurt', 'milk', 'butter', 'ghee',
  'cheese', 'cream', 'bread', 'pasta', 'noodles', 'tofu', 'fish', 'prawns', 'corn', 'beans',
  'rajma', 'chole', 'chickpeas', 'lentils', 'cumin', 'jeera', 'turmeric', 'haldi', 'masala', 'garam',
  'mustard', 'fenugreek', 'methi', 'apple', 'banana', 'mango', 'avocado', 'oats', 'poha', 'suji',
];

function readEnv(key) {
  return String(process.env[key] || '').trim().replace(/^['"]|['"]$/g, '');
}

function getSpeechConfig() {
  return {
    url: readEnv('GNANI_STT_URL') || DEFAULT_STT_URL,
    apiKey: readEnv('GNANI_API_KEY'),
    language: readEnv('GNANI_STT_LANGUAGE') || DEFAULT_LANGUAGE,
  };
}

export function isSpeechConfigured() {
  return Boolean(getSpeechConfig().apiKey);
}

export function isSupportedAudioType(mimeType) {
  return Boolean(AUDIO_EXTENSIONS[String(mimeType || '').toLowerCase().split(';')[0]]);
}

function createSpeechError(message, { code = 'API_ERROR', status } = {}) {
  return Object.assign(new Error(message), { code, status, provider: 'gnani' });
}

export async function transcribeAudio({ audioBase64, mimeType, languageCode }) {
  const config = getSpeechConfig();

  if (!config.apiKey) {
    throw createSpeechError('GNANI_API_KEY is not set in server/.env.', { code: 'MISSING_API_KEY' });
  }

  const normalizedMimeType = String(mimeType || '').toLowerCase().split(';')[0];
  const extension = AUDIO_EXTENSIONS[normalizedMimeType];
  const language = SUPPORTED_LANGUAGES.has(languageCode) ? languageCode : config.language;

  const form = new FormData();
  form.append(
    'audio_file',
    new Blob([Buffer.from(audioBase64, 'base64')], { type: normalizedMimeType }),
    `ingredients.${extension}`,
  );
  form.append('language_code', language);
  form.append('format', 'transcribe');
  form.append('bias_list', INGREDIENT_BIAS_WORDS.join(','));
  form.append('bias_score', '1');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: { 'X-API-Key-ID': config.apiKey },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    throw createSpeechError(`Gnani STT request failed: ${error.message}`, { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `Gnani STT returned ${response.status}`;
    throw createSpeechError(String(message).split(config.apiKey).join('[redacted]'), {
      code: response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
      status: response.ok ? 502 : response.status,
    });
  }

  const transcript = String(payload?.transcript || '').trim();

  return {
    provider: 'gnani',
    requestId: payload?.request_id || null,
    language,
    transcript,
    ingredients: extractIngredientsFromTranscript(transcript),
  };
}

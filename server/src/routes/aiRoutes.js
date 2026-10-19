import express from 'express';
import { detectIngredientsInImage, getConfiguredVisionProviders } from '../services/ingredientVision.js';
import { isSpeechConfigured, isSupportedAudioType, transcribeAudio } from '../services/gnaniSpeech.js';

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

// Accepts raw base64 or a data URI and returns { base64, mimeType }.
function parseBase64Payload(value, fallbackMimeType) {
  const raw = String(value || '').trim();
  const dataUriMatch = raw.match(/^data:([^;,]+)[^,]*;base64,(.*)$/s);

  return {
    base64: (dataUriMatch ? dataUriMatch[2] : raw).replace(/\s/g, ''),
    mimeType: String(dataUriMatch?.[1] || fallbackMimeType || '').toLowerCase(),
  };
}

// error.status is the upstream provider's status; translate it to a gateway status for our client.
function sendAiError(res, error, fallbackMessage) {
  let status = 502;
  if (error?.code === 'MISSING_API_KEY') status = 503;
  else if (error?.status === 429) status = 429;
  else if (error?.code === 'NETWORK_ERROR') status = 504;

  return res.status(status).json({
    message: error?.message || fallbackMessage,
    code: error?.code || 'API_ERROR',
    provider: error?.provider || null,
    upstreamStatus: error?.status || null,
  });
}

router.get('/status', (_req, res) => {
  res.json({
    vision: getConfiguredVisionProviders(),
    speech: isSpeechConfigured() ? 'gnani' : null,
  });
});

router.post('/scan-ingredients', async (req, res) => {
  const { base64, mimeType } = parseBase64Payload(req.body?.image, req.body?.mimeType || 'image/jpeg');
  const normalizedMimeType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

  if (!base64) {
    return res.status(400).json({ message: 'image (base64) is required.', code: 'INVALID_IMAGE_DATA' });
  }

  if (!ALLOWED_IMAGE_TYPES.has(normalizedMimeType)) {
    return res.status(400).json({ message: 'Only jpg, png, and webp images are supported.', code: 'INVALID_IMAGE_DATA' });
  }

  try {
    const result = await detectIngredientsInImage({ imageBase64: base64, mimeType: normalizedMimeType });
    return res.json(result);
  } catch (error) {
    return sendAiError(res, error, 'Ingredient detection failed.');
  }
});

router.post('/transcribe', async (req, res) => {
  const { base64, mimeType } = parseBase64Payload(req.body?.audio, req.body?.mimeType);

  if (!base64) {
    return res.status(400).json({ message: 'audio (base64) is required.', code: 'INVALID_AUDIO_DATA' });
  }

  if (!isSupportedAudioType(mimeType)) {
    return res.status(400).json({
      message: `Unsupported audio type "${mimeType || 'unknown'}". Gnani accepts WAV, MP3, OGG, FLAC, AAC and M4A.`,
      code: 'INVALID_AUDIO_DATA',
    });
  }

  try {
    const result = await transcribeAudio({
      audioBase64: base64,
      mimeType,
      languageCode: req.body?.languageCode,
    });
    return res.json(result);
  } catch (error) {
    return sendAiError(res, error, 'Speech transcription failed.');
  }
});

export default router;

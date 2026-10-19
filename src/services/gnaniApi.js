import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { requestWithFallback } from './api';
import { detectIngredientsFromImage } from './claudeApi';

// Vision and speech calls take seconds, not the 1.5s budget used for favorites/history.
const SCAN_TIMEOUT_MS = 30000;
const TRANSCRIBE_TIMEOUT_MS = 35000;

// Browser recording formats that Gnani STT accepts, in order of preference.
const WEB_RECORDING_MIME_TYPES = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

// The backend is unreachable or has no vision key: keep the old on-device scanner as a safety net.
function shouldUseDeviceScanner(error) {
    return !error?.status || error?.code === 'MISSING_API_KEY';
}

export async function scanIngredients(base64Image, { mimeType = 'image/jpeg' } = {}) {
    try {
        const result = await requestWithFallback('/ai/scan-ingredients', {
            method: 'POST',
            body: { image: base64Image, mimeType },
            timeoutMs: SCAN_TIMEOUT_MS,
        });

        return {
            provider: result?.provider || null,
            ingredients: Array.isArray(result?.ingredients) ? result.ingredients : [],
        };
    } catch (error) {
        if (!shouldUseDeviceScanner(error)) {
            throw error;
        }

        console.log(`[Scanner] Backend scan unavailable (${error?.message}); using on-device scanner.`);
        const names = await detectIngredientsFromImage(base64Image, { mimeType });
        return {
            provider: 'device',
            ingredients: names.map((name) => ({ name, confidence: null })),
        };
    }
}

// Returns null on web when the browser cannot record a format Gnani accepts.
export function getWebRecordingMimeType() {
    if (Platform.OS !== 'web') {
        return null;
    }

    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return null;
    }

    return WEB_RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function inferAudioMimeType(uri) {
    const normalizedUri = String(uri || '').toLowerCase();

    if (normalizedUri.endsWith('.wav')) return 'audio/wav';
    if (normalizedUri.endsWith('.aac')) return 'audio/aac';
    if (normalizedUri.endsWith('.mp3')) return 'audio/mpeg';
    // expo-audio's HIGH_QUALITY preset records AAC in an .m4a container on iOS and Android.
    return 'audio/mp4';
}

async function readAudioAsBase64(uri) {
    if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Could not read the recording.'));
            reader.readAsDataURL(blob);
        });

        return { base64: dataUrl.split(',')[1] || '', mimeType: blob.type || getWebRecordingMimeType() };
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return { base64, mimeType: inferAudioMimeType(uri) };
}

export async function transcribeIngredientSpeech(audioUri, { languageCode = 'en-IN' } = {}) {
    const { base64, mimeType } = await readAudioAsBase64(audioUri);

    if (!base64) {
        throw new Error('The recording was empty. Please try again.');
    }

    return requestWithFallback('/ai/transcribe', {
        method: 'POST',
        body: { audio: base64, mimeType, languageCode },
        timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    });
}

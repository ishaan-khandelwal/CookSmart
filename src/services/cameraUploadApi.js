import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getExtraConfigValue(key) {
    return (
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest2?.extra?.expoClient?.extra?.[key] ||
        ''
    );
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || getExtraConfigValue('EXPO_PUBLIC_API_URL');

function buildUploadUrl(pathname) {
    if (!API_URL) {
        throw new Error('EXPO_PUBLIC_API_URL is not configured');
    }

    return `${API_URL.replace(/\/$/, '')}${pathname}`;
}

function inferMimeType(uri, fallback = 'image/jpeg') {
    const normalizedUri = String(uri || '').toLowerCase();

    if (normalizedUri.startsWith('data:image/png')) return 'image/png';
    if (normalizedUri.startsWith('data:image/webp')) return 'image/webp';
    if (normalizedUri.endsWith('.png')) return 'image/png';
    if (normalizedUri.endsWith('.webp')) return 'image/webp';
    return fallback;
}

function extensionForMimeType(mimeType) {
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    return 'jpg';
}

async function createUploadPart(uri, mimeType, fileName) {
    if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new File([blob], fileName, { type: mimeType });
    }

    return {
        uri,
        name: fileName,
        type: mimeType,
    };
}

export async function uploadWebcamImage({ uri, mimeType, userId, filePrefix = 'webcam' }) {
    if (!uri) {
        throw new Error('Image URI is required for upload');
    }

    const normalizedMimeType = mimeType || inferMimeType(uri);
    const extension = extensionForMimeType(normalizedMimeType);
    const fileName = `${filePrefix}-${Date.now()}.${extension}`;
    const formData = new FormData();
    const uploadPart = await createUploadPart(uri, normalizedMimeType, fileName);

    formData.append('image', uploadPart);
    formData.append('filePrefix', filePrefix);

    if (userId) {
        formData.append('userId', userId);
    }

    const response = await fetch(buildUploadUrl('/uploads/webcam'), {
        method: 'POST',
        body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Could not upload webcam image');
    }

    return data;
}

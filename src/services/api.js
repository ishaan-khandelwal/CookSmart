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

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) {
    return '';
  }

  return raw.replace(/\/$/, '');
}

function getExpoHost() {
  const hostValue =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const cleanedHost = String(hostValue || '').trim();

  if (!cleanedHost) {
    return '';
  }

  return cleanedHost.split(':')[0];
}

function createExpoHostFallback(baseUrl) {
  const host = getExpoHost();
  if (!host || !baseUrl) {
    return '';
  }

  try {
    const parsed = new URL(baseUrl);
    return `${parsed.protocol}//${host}:${parsed.port || (parsed.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    return '';
  }
}

function getApiBaseCandidates() {
  const configuredUrl = normalizeBaseUrl(API_URL);
  const candidates = [];
  const expoHost = getExpoHost();

  if (configuredUrl) {
    candidates.push(configuredUrl);
  }
  if (!configuredUrl && expoHost) {
    candidates.push(`http://${expoHost}:5000`);
  }

  if (configuredUrl && /(localhost|127\.0\.0\.1)/i.test(configuredUrl) && Platform.OS === 'android') {
    candidates.push(configuredUrl.replace(/localhost|127\.0\.0\.1/i, '10.0.2.2'));
  }

  const expoHostFallback = normalizeBaseUrl(createExpoHostFallback(configuredUrl));
  if (expoHostFallback && expoHostFallback !== configuredUrl) {
    candidates.push(expoHostFallback);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function buildUrl(baseUrl, path, query = {}) {
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function formatNetworkError(error, url) {
  const message = String(error?.message || '');

  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return `Cannot reach API at ${url}. Make sure the Express server is running and your phone and laptop are on the same Wi-Fi.`;
  }

  return message || 'Request failed';
}

async function requestWithFallback(path, { method = 'GET', query = {}, body } = {}) {
  const baseCandidates = getApiBaseCandidates();
  if (!baseCandidates.length) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  let lastError = null;

  for (const baseUrl of baseCandidates) {
    const url = buildUrl(baseUrl, path, query);
    let response;

    try {
      response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      lastError = new Error(formatNetworkError(error, url));
      continue;
    }

    return parseResponse(response);
  }

  throw lastError || new Error('Request failed');
}

export async function fetchFavorites(userId) {
  return requestWithFallback('/favorites', { query: { userId } });
}

export async function createFavorite(payload) {
  return requestWithFallback('/favorites', { method: 'POST', body: payload });
}

export async function fetchHistory(userId) {
  return requestWithFallback('/history', { query: { userId } });
}

export async function createHistory(payload) {
  return requestWithFallback('/history', { method: 'POST', body: payload });
}

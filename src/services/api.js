import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCAL_FAVORITES_KEY = 'cooksmart:localFavorites';
const LOCAL_HISTORY_KEY = 'cooksmart:localHistory';

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

function createLocalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readLocalList(key) {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return [];
  }

  const parsedValue = JSON.parse(rawValue);
  return Array.isArray(parsedValue) ? parsedValue : [];
}

async function writeLocalList(key, items) {
  await AsyncStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function fetchLocalFavorites(userId) {
  if (!userId) {
    return [];
  }

  const favorites = await readLocalList(LOCAL_FAVORITES_KEY);
  return sortNewestFirst(favorites.filter((item) => item.userId === userId));
}

async function createLocalFavorite(payload = {}) {
  const userId = String(payload.userId || '').trim();
  const title = String(payload.title || '').trim();

  if (!userId || !title) {
    throw new Error('title and userId are required');
  }

  const favorites = await readLocalList(LOCAL_FAVORITES_KEY);
  const existingIndex = favorites.findIndex((item) => item.userId === userId && item.title === title);
  const existingFavorite = existingIndex >= 0 ? favorites[existingIndex] : null;
  const now = new Date().toISOString();
  const favorite = {
    _id: existingFavorite?._id || createLocalId('favorite'),
    recipeId: String(payload.recipeId || existingFavorite?.recipeId || '').trim(),
    provider: String(payload.provider || existingFavorite?.provider || 'manual').trim() || 'manual',
    title,
    image: String(payload.image || existingFavorite?.image || '').trim(),
    source: String(payload.source || existingFavorite?.source || 'local').trim() || 'local',
    vegetarian: Boolean(payload.vegetarian),
    vegan: Boolean(payload.vegan),
    userId,
    createdAt: existingFavorite?.createdAt || now,
    updatedAt: now,
    localOnly: true,
  };

  if (existingIndex >= 0) {
    favorites[existingIndex] = favorite;
  } else {
    favorites.push(favorite);
  }

  await writeLocalList(LOCAL_FAVORITES_KEY, favorites);
  return favorite;
}

async function fetchLocalHistory(userId) {
  if (!userId) {
    return [];
  }

  const history = await readLocalList(LOCAL_HISTORY_KEY);
  return sortNewestFirst(history.filter((item) => item.userId === userId)).slice(0, 20);
}

async function createLocalHistory(payload = {}) {
  const userId = String(payload.userId || '').trim();
  const title = String(payload.title || '').trim();

  if (!userId || !title) {
    throw new Error('userId and title are required');
  }

  const history = await readLocalList(LOCAL_HISTORY_KEY);
  const now = new Date().toISOString();
  const historyItem = {
    _id: createLocalId('history'),
    userId,
    title,
    type: String(payload.type || 'ingredient-search').trim() || 'ingredient-search',
    source: String(payload.source || 'local').trim() || 'local',
    ingredients: Array.isArray(payload.ingredients)
      ? payload.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
    resultCount: typeof payload.resultCount === 'number' && Number.isFinite(payload.resultCount)
      ? payload.resultCount
      : null,
    createdAt: now,
    updatedAt: now,
    localOnly: true,
  };

  history.push(historyItem);
  await writeLocalList(LOCAL_HISTORY_KEY, history.slice(-100));
  return historyItem;
}

export async function fetchFavorites(userId) {
  try {
    return await requestWithFallback('/favorites', { query: { userId } });
  } catch (error) {
    return fetchLocalFavorites(userId);
  }
}

export async function createFavorite(payload) {
  try {
    return await requestWithFallback('/favorites', { method: 'POST', body: payload });
  } catch (error) {
    return createLocalFavorite(payload);
  }
}

export async function fetchHistory(userId) {
  try {
    return await requestWithFallback('/history', { query: { userId } });
  } catch (error) {
    return fetchLocalHistory(userId);
  }
}

export async function createHistory(payload) {
  try {
    return await requestWithFallback('/history', { method: 'POST', body: payload });
  } catch (error) {
    return createLocalHistory(payload);
  }
}

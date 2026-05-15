import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCAL_FAVORITES_KEY = 'cooksmart:localFavorites';
const LOCAL_HISTORY_KEY = 'cooksmart:localHistory';
const FAVORITES_CACHE_KEY_PREFIX = 'cooksmart:cachedFavorites:';
const HISTORY_CACHE_KEY_PREFIX = 'cooksmart:cachedHistory:';
const REQUEST_TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 30000;

const memoryCache = {
  favorites: new Map(),
  history: new Map(),
};

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

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;

    try {
      response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch (error) {
      lastError = new Error(formatNetworkError(error, url));
      continue;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

function cacheKey(prefix, userId) {
  return `${prefix}${String(userId || '').trim()}`;
}

function getMemoryCache(type, userId) {
  const cached = memoryCache[type]?.get(String(userId || '').trim());
  if (!cached) {
    return null;
  }

  return {
    data: cached.data,
    isFresh: Date.now() - cached.updatedAt < CACHE_TTL_MS,
  };
}

async function readPersistentCache(prefix, userId) {
  if (!userId) {
    return [];
  }

  try {
    const rawValue = await AsyncStorage.getItem(cacheKey(prefix, userId));
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

async function writePersistentCache(prefix, userId, items) {
  if (!userId) {
    return;
  }

  try {
    await AsyncStorage.setItem(cacheKey(prefix, userId), JSON.stringify(Array.isArray(items) ? items : []));
  } catch { }
}

function setMemoryCache(type, userId, items) {
  if (!userId || !memoryCache[type]) {
    return;
  }

  memoryCache[type].set(String(userId).trim(), {
    data: Array.isArray(items) ? items : [],
    updatedAt: Date.now(),
  });
}

async function setCachedList(type, prefix, userId, items) {
  const list = Array.isArray(items) ? items : [];
  setMemoryCache(type, userId, list);
  await writePersistentCache(prefix, userId, list);
  return list;
}

function mergeCachedItem(items, item, matchItem) {
  const list = Array.isArray(items) ? items : [];
  const nextItem = item || {};
  const existingIndex = list.findIndex((current) => matchItem(current, nextItem));
  const nextList = [...list];

  if (existingIndex >= 0) {
    nextList[existingIndex] = nextItem;
  } else {
    nextList.unshift(nextItem);
  }

  return sortNewestFirst(nextList);
}

function mergeFavoritesLists(primaryItems, secondaryItems) {
  const seen = new Set();
  const combined = [...(primaryItems || []), ...(secondaryItems || [])];
  
  const merged = sortNewestFirst(combined)
    .filter((item) => {
      if (!item) return false;
      const key = [
        item?.userId || '',
        item?.title || '',
        item?.recipeId || '',
        item?.provider || '',
      ].join(':').toLowerCase();
      
      if (!key.trim() || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  console.log(`[mergeFavoritesLists] In: ${combined.length} (Primary: ${primaryItems?.length || 0}, Secondary: ${secondaryItems?.length || 0}), Out: ${merged.length}`);
  return merged;
}

function mergeHistoryLists(primaryItems, secondaryItems) {
  const seen = new Set();
  return sortNewestFirst([...(primaryItems || []), ...(secondaryItems || [])])
    .filter((item) => {
      const ingredientsKey = Array.isArray(item?.ingredients) ? item.ingredients.join(',') : '';
      const semanticKey = [
        item?.title || '',
        item?.type || '',
        item?.source || '',
        ingredientsKey,
        typeof item?.resultCount === 'number' ? item.resultCount : '',
      ].join(':');
      const key = semanticKey.replace(/:+/g, ':').trim() || item?._id || `${item?.title || ''}:${item?.createdAt || ''}`;
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

export async function getCachedFavorites(userId) {
  const cached = getMemoryCache('favorites', userId);
  if (cached?.data) {
    return cached.data;
  }

  const [persistentFavorites, localFavorites] = await Promise.all([
    readPersistentCache(FAVORITES_CACHE_KEY_PREFIX, userId),
    fetchLocalFavorites(userId),
  ]);
  const mergedFavorites = mergeFavoritesLists(persistentFavorites, localFavorites);

  if (mergedFavorites.length) {
    await setCachedList('favorites', FAVORITES_CACHE_KEY_PREFIX, userId, mergedFavorites);
  }

  return mergedFavorites;
}

export async function getCachedHistory(userId) {
  const cached = getMemoryCache('history', userId);
  if (cached?.data) {
    return cached.data;
  }

  const [persistentHistory, localHistory] = await Promise.all([
    readPersistentCache(HISTORY_CACHE_KEY_PREFIX, userId),
    fetchLocalHistory(userId),
  ]);
  const mergedHistory = mergeHistoryLists(persistentHistory, localHistory);

  if (mergedHistory.length) {
    await setCachedList('history', HISTORY_CACHE_KEY_PREFIX, userId, mergedHistory);
  }

  return mergedHistory;
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

export async function fetchFavorites(userId, options = {}) {
  const cached = getMemoryCache('favorites', userId);
  if (!options.force && cached?.isFresh) {
    return cached.data;
  }

  if (options.preferCache && cached?.data) {
    return cached.data;
  }

  try {
    const favorites = await requestWithFallback('/favorites', { query: { userId } });
    const localFavorites = await fetchLocalFavorites(userId);
    const merged = mergeFavoritesLists(favorites, localFavorites);
    console.log(`[fetchFavorites] User ${userId}: Remote: ${favorites.length}, Local: ${localFavorites.length}, Merged: ${merged.length}`);
    return setCachedList('favorites', FAVORITES_CACHE_KEY_PREFIX, userId, merged);
  } catch (error) {
    console.log(`[fetchFavorites] Error fetching from remote, falling back to local: ${error.message}`);
    const localFavorites = await fetchLocalFavorites(userId);
    return setCachedList('favorites', FAVORITES_CACHE_KEY_PREFIX, userId, localFavorites);
  }
}

export async function createFavorite(payload) {
  const favorite = await createLocalFavorite(payload);
  const userId = String(payload?.userId || favorite?.userId || '').trim();

  if (userId) {
    const existingFavorites = await getCachedFavorites(userId);
    const nextFavorites = mergeCachedItem(
      existingFavorites,
      favorite,
      (current, next) => current._id === next._id || current.title === next.title,
    );
    await setCachedList('favorites', FAVORITES_CACHE_KEY_PREFIX, userId, nextFavorites);
  }

  requestWithFallback('/favorites', { method: 'POST', body: payload })
    .then(async (remoteFavorite) => {
      const remoteUserId = String(payload?.userId || remoteFavorite?.userId || '').trim();
      if (!remoteUserId) {
        return;
      }

      const existingFavorites = await getCachedFavorites(remoteUserId);
      const nextFavorites = mergeFavoritesLists([remoteFavorite], existingFavorites);
      await setCachedList('favorites', FAVORITES_CACHE_KEY_PREFIX, remoteUserId, nextFavorites);
    })
    .catch(() => {});

  return favorite;
}

export async function fetchHistory(userId, options = {}) {
  const cached = getMemoryCache('history', userId);
  if (!options.force && cached?.isFresh) {
    return cached.data;
  }

  if (options.preferCache && cached?.data) {
    return cached.data;
  }

  try {
    const history = await requestWithFallback('/history', { query: { userId } });
    const localHistory = await fetchLocalHistory(userId);
    return setCachedList('history', HISTORY_CACHE_KEY_PREFIX, userId, mergeHistoryLists(history, localHistory));
  } catch (error) {
    const localHistory = await fetchLocalHistory(userId);
    return setCachedList('history', HISTORY_CACHE_KEY_PREFIX, userId, localHistory);
  }
}

export async function createHistory(payload) {
  const historyItem = await createLocalHistory(payload);
  const userId = String(payload?.userId || historyItem?.userId || '').trim();

  if (userId) {
    const existingHistory = await getCachedHistory(userId);
    const nextHistory = mergeCachedItem(
      existingHistory,
      historyItem,
      (current, next) => current._id === next._id,
    ).slice(0, 20);
    await setCachedList('history', HISTORY_CACHE_KEY_PREFIX, userId, nextHistory);
  }

  requestWithFallback('/history', { method: 'POST', body: payload })
    .then(async (remoteHistoryItem) => {
      const remoteUserId = String(payload?.userId || remoteHistoryItem?.userId || '').trim();
      if (!remoteUserId) {
        return;
      }

      const existingHistory = await getCachedHistory(remoteUserId);
      const nextHistory = mergeHistoryLists([remoteHistoryItem], existingHistory);
      await setCachedList('history', HISTORY_CACHE_KEY_PREFIX, remoteUserId, nextHistory);
    })
    .catch(() => {});

  return historyItem;
}

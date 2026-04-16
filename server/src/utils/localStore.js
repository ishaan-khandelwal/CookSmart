import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_PATH = path.join(DATA_DIR, 'local-store.json');

const DEFAULT_STORE = {
  favorites: [],
  history: [],
  captures: [],
};

let writeQueue = Promise.resolve();

function sortNewestFirst(items) {
  return [...items].sort(
    (left, right) =>
      new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime()
  );
}

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStoreFile();

  try {
    const rawValue = await fs.readFile(STORE_PATH, 'utf8');
    const parsedValue = JSON.parse(rawValue);

    return {
      favorites: Array.isArray(parsedValue?.favorites) ? parsedValue.favorites : [],
      history: Array.isArray(parsedValue?.history) ? parsedValue.history : [],
      captures: Array.isArray(parsedValue?.captures) ? parsedValue.captures : [],
    };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

async function writeStore(nextStore) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(nextStore, null, 2), 'utf8');
}

function updateStore(mutator) {
  writeQueue = writeQueue.then(async () => {
    const currentStore = await readStore();
    const nextStore = await mutator(currentStore);
    await writeStore(nextStore);
    return nextStore;
  });

  return writeQueue;
}

function normalizeTimestamp(existingValue) {
  return existingValue || new Date().toISOString();
}

export async function getLocalFavorites(userId) {
  const store = await readStore();
  return sortNewestFirst(store.favorites.filter((item) => item.userId === userId));
}

export async function upsertLocalFavorite(payload) {
  const normalizedTitle = String(payload.title || '').trim();
  const normalizedUserId = String(payload.userId || '').trim();

  const nextStore = await updateStore((store) => {
    const now = new Date().toISOString();
    const existingIndex = store.favorites.findIndex(
      (item) => item.userId === normalizedUserId && item.title === normalizedTitle
    );

    const previousFavorite =
      existingIndex >= 0
        ? store.favorites[existingIndex]
        : null;

    const favorite = {
      _id: previousFavorite?._id || randomUUID(),
      recipeId: String(payload.recipeId || previousFavorite?.recipeId || '').trim(),
      provider: String(payload.provider || previousFavorite?.provider || 'manual').trim() || 'manual',
      title: normalizedTitle,
      image: String(payload.image || previousFavorite?.image || '').trim(),
      source: String(payload.source || previousFavorite?.source || 'manual').trim() || 'manual',
      vegetarian: Boolean(payload.vegetarian),
      vegan: Boolean(payload.vegan),
      userId: normalizedUserId,
      createdAt: normalizeTimestamp(previousFavorite?.createdAt),
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      store.favorites[existingIndex] = favorite;
    } else {
      store.favorites.push(favorite);
    }

    return store;
  });

  return nextStore.favorites.find(
    (item) => item.userId === normalizedUserId && item.title === normalizedTitle
  );
}

export async function getLocalHistory(userId) {
  const store = await readStore();
  return sortNewestFirst(store.history.filter((item) => item.userId === userId)).slice(0, 20);
}

export async function createLocalHistory(payload) {
  const nextStore = await updateStore((store) => {
    const now = new Date().toISOString();

    store.history.push({
      _id: randomUUID(),
      userId: String(payload.userId || '').trim(),
      title: String(payload.title || '').trim(),
      type: String(payload.type || 'ingredient-search').trim() || 'ingredient-search',
      source: String(payload.source || 'manual').trim() || 'manual',
      ingredients: Array.isArray(payload.ingredients)
        ? payload.ingredients.map((item) => String(item).trim()).filter(Boolean)
        : [],
      resultCount:
        typeof payload.resultCount === 'number' && Number.isFinite(payload.resultCount)
          ? payload.resultCount
          : null,
      createdAt: now,
      updatedAt: now,
    });

    return store;
  });

  return nextStore.history[nextStore.history.length - 1];
}

export async function createLocalCapture(payload) {
  const nextStore = await updateStore((store) => {
    const now = new Date().toISOString();

    store.captures.push({
      _id: randomUUID(),
      userId: String(payload.userId || '').trim(),
      filename: String(payload.filename || '').trim(),
      originalName: String(payload.originalName || '').trim(),
      mimeType: String(payload.mimeType || '').trim(),
      size: Number(payload.size || 0),
      relativePath: String(payload.relativePath || '').trim(),
      source: String(payload.source || 'webcam').trim() || 'webcam',
      createdAt: now,
      updatedAt: now,
    });

    return store;
  });

  return nextStore.captures[nextStore.captures.length - 1];
}

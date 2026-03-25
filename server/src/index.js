import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import Favorite from './models/favorite.js';
import History from './models/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/favorites', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });
    return res.json(favorites);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load favorites' });
  }
});

app.post('/favorites', async (req, res) => {
  try {
    const { title, image = '', source = 'manual', userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: 'title and userId are required' });
    }

    const favorite = await Favorite.create({
      title,
      image,
      source,
      userId,
    });

    return res.status(201).json(favorite);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create favorite' });
  }
});

app.get('/history', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const history = await History.find({ userId }).sort({ createdAt: -1 }).limit(20);
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load history' });
  }
});

app.post('/history', async (req, res) => {
  try {
    const {
      userId,
      title,
      type = 'ingredient-search',
      source = 'manual',
      ingredients = [],
    } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ message: 'userId and title are required' });
    }

    const historyItem = await History.create({
      userId,
      title,
      type,
      source,
      ingredients: Array.isArray(ingredients)
        ? ingredients.map((item) => String(item).trim()).filter(Boolean)
        : [],
    });

    return res.status(201).json(historyItem);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save history' });
  }
});

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in server/.env');
  }

  let mongoHost = 'unknown-host';
  try {
    mongoHost = new URL(process.env.MONGODB_URI).host;
  } catch (_error) {
    mongoHost = 'invalid-uri';
  }

  console.log(`Attempting MongoDB connection to ${mongoHost}`);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  app.listen(port, () => {
    console.log(`CookSmart API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  const errorCode = error.code ? ` code=${error.code}` : '';
  const errorName = error.name ? ` name=${error.name}` : '';
  const hint =
    error.message && /server selection|timed out|econnrefused|enotfound/i.test(error.message)
      ? ' Check Atlas cluster status, the exact hostname from Atlas, local DNS connectivity, and Atlas Network Access/IP whitelist.'
      : '';

  console.error(`Server startup error:${errorName}${errorCode} ${error.message}.${hint}`);
  process.exit(1);
});

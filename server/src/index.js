import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase, getDatabaseStatus } from './config/db.js';
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
  res.json({
    ok: true,
    database: getDatabaseStatus(),
  });
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
    const {
      recipeId = '',
      provider = 'manual',
      title,
      image = '',
      source = 'manual',
      userId,
    } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: 'title and userId are required' });
    }

    const normalizedTitle = String(title).trim();
    const favorite = await Favorite.findOneAndUpdate(
      {
        userId,
        title: normalizedTitle,
      },
      {
        $setOnInsert: {
          recipeId: String(recipeId).trim(),
          provider: String(provider).trim() || 'manual',
          title: normalizedTitle,
          image,
          source,
          userId,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

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
      resultCount,
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
      resultCount:
        typeof resultCount === 'number' && Number.isFinite(resultCount)
          ? resultCount
          : null,
    });

    return res.status(201).json(historyItem);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save history' });
  }
});

async function start() {
  await connectToDatabase(process.env.MONGODB_URI);

  console.log("DB NAME:", mongoose.connection.name);

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

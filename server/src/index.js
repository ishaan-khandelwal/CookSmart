import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase, getDatabaseStatus, isDatabaseConnected } from './config/db.js';
import Favorite from './models/favorite.js';
import History from './models/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });


const app = express();
const port = process.env.PORT || 5000;
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '20mb';

app.use(cors());
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

app.get('/health', (_req, res) => {
  const database = getDatabaseStatus();

  res.json({
    ok: true,
    database,
    services: {
      api: 'ready',
      database,
    },
  });
});

function requireDatabase(_req, res, next) {
  if (isDatabaseConnected()) {
    return next();
  }

  return res.status(503).json({
    message:
      'Database is currently unavailable. Check your MongoDB Atlas network access or server/.env configuration and try again.',
  });
}

app.get('/favorites', requireDatabase, async (req, res) => {
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

app.post('/favorites', requireDatabase, async (req, res) => {
  try {
    const {
      recipeId = '',
      provider = 'manual',
      title,
      image = '',
      source = 'manual',
      vegetarian = false,
      vegan = false,
      userId,
    } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: 'title and userId are required' });
    }

    const normalizedTitle = String(title).trim();
    const normalizedRecipeId = String(recipeId).trim();
    const normalizedProvider = String(provider).trim() || 'manual';
    const normalizedSource = String(source).trim() || 'manual';
    const normalizedImage = String(image || '').trim();
    const existingFavorite = await Favorite.findOne({
      userId,
      title: normalizedTitle,
    });

    const favorite = await Favorite.findOneAndUpdate(
      {
        userId,
        title: normalizedTitle,
      },
      {
        $set: {
          recipeId: normalizedRecipeId || existingFavorite?.recipeId || '',
          provider: normalizedProvider || existingFavorite?.provider || 'manual',
          title: normalizedTitle,
          image: normalizedImage || existingFavorite?.image || '',
          source: normalizedSource || existingFavorite?.source || 'manual',
          vegetarian: Boolean(vegetarian),
          vegan: Boolean(vegan),
          userId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json(favorite);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create favorite' });
  }
});

app.get('/history', requireDatabase, async (req, res) => {
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

app.post('/history', requireDatabase, async (req, res) => {
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

app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Uploaded recipe image is too large. Please try again with a smaller image.',
    });
  }

  return next(error);
});

async function start() {
  const databaseConnected = await connectToDatabase(process.env.MONGODB_URI);

  if (databaseConnected) {
    console.log('DB NAME:', mongoose.connection.name);
  } else {
    console.warn('Starting API without a database connection. DB-backed routes will return 503 until MongoDB is reachable.');
  }

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

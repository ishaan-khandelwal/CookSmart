const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const Favorite = require('./models/favorite');

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

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in server/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  app.listen(port, () => {
    console.log(`CookSmart API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  const hint =
    error.message && /server selection|timed out|econnrefused|enotfound/i.test(error.message)
      ? ' Check Atlas Network Access/IP whitelist, cluster status, and the connection string.'
      : '';

  console.error(`Server startup error: ${error.message}.${hint}`);
  process.exit(1);
});

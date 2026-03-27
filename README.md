# CookSmart

CookSmart is an Expo React Native app for ingredient scanning, recipe discovery, favorites, and meal-planning flows. The mobile app uses Firebase Auth and an Express API backed by MongoDB for saved favorites and activity history.

## Stack

- Expo + React Native
- Firebase Authentication
- Express
- MongoDB Atlas + Mongoose
- Spoonacular API

## App Setup

1. Install the mobile app dependencies:

```bash
npm install
```

2. Install the API dependencies:

```bash
npm --prefix server install
```

3. Set the mobile app environment variables in the root `.env` file:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:5000
EXPO_PUBLIC_SPOONACULAR_API_KEY=your_spoonacular_key
EXPO_PUBLIC_ANTHROPIC_KEY=your_anthropic_key
```

4. Set the API environment variables in `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cooksmart?retryWrites=true&w=majority
```

5. Start the Mongo-backed API:

```bash
npm run server
```

6. Start Expo in a second terminal:

```bash
npm start
```

## MongoDB Integration

The Express API in [server/src/index.js](/c:/Users/ishaa/OneDrive/Desktop/CookSmart/server/src/index.js) persists:

- favorites in [server/src/models/favorite.js](/c:/Users/ishaa/OneDrive/Desktop/CookSmart/server/src/models/favorite.js)
- search and detail activity in [server/src/models/history.js](/c:/Users/ishaa/OneDrive/Desktop/CookSmart/server/src/models/history.js)

The mobile app reads and writes that data through [src/services/api.js](/c:/Users/ishaa/OneDrive/Desktop/CookSmart/src/services/api.js).

To verify the API is connected, open `http://localhost:5000/health`. A healthy response now includes the MongoDB connection state.

## Notes

- On a real phone, `EXPO_PUBLIC_API_URL` must use your computer's local network IP, not `localhost`.
- Favorites are deduplicated per user and title to avoid duplicate saves from repeated taps.

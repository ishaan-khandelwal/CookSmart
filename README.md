# CookSmart

CookSmart is an AI-powered culinary companion designed to reduce food waste and simplify meal planning.

> [!IMPORTANT]
> **New to the project?** Follow the detailed **[Setup Guide (SETUP.md)](./SETUP.md)** to install dependencies and configure your environment.

## 📦 Project Dependencies
Dependencies are managed separately for the mobile app and the backend:

- **Mobile App**: Defined in [package.json](./package.json)
- **Backend API**: Defined in [server/package.json](./server/package.json)

See [SETUP.md](./SETUP.md) for a full breakdown.

## 🛠️ Stack
- **Frontend**: Expo + React Native
- **Backend**: Node.js/Express
- **Database**: MongoDB Atlas + Mongoose
- **Auth**: Firebase Authentication
- **AI/ML Integration**: Ingredient Scanning & Recipe Generation
- **APIs**: Spoonacular API

## 🏃 Quick Start

1. **Install All Dependencies**:
   ```bash
   npm install && cd server && npm install && cd ..
   ```

2. **Configure Environment**:
   - Fill out the `.env` files (see [SETUP.md](./SETUP.md) for templates).

3. **Run Backend**:
   ```bash
   npm run server
   ```

4. **Run Mobile App**:
   ```bash
   npm start
   ```

## 📂 Project Structure
- `src/`: React Native source code (Screens, Components, Navigation).
- `server/`: Express API and MongoDB models.
- `assets/`: App icons, fonts, and images.

---
*For more details on database integration and specific flows, refer to the original documentation sections or the SETUP.md.*


import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    recipeId: {
      type: String,
      default: '',
      trim: true,
    },
    provider: {
      type: String,
      default: 'manual',
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {    
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      default: 'manual',
      trim: true,
    },
    vegetarian: {
      type: Boolean,
      default: false,
    },
    vegan: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

favoriteSchema.index({ userId: 1, title: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);

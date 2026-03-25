import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
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

export default mongoose.model('Favorite', favoriteSchema);

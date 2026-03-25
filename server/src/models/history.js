import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: 'ingredient-search',
      trim: true,
    },
    source: {
      type: String,
      default: 'manual',
      trim: true,
    },
    ingredients: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('History', historySchema);

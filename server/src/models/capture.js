import mongoose from 'mongoose';

const captureSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    relativePath: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: 'webcam',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Capture', captureSchema);

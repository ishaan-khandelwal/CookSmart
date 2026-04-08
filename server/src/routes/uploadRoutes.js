import express from 'express';
import Capture from '../models/capture.js';
import { webcamUploadMiddleware } from '../middleware/uploadMiddleware.js';
import { isDatabaseConnected } from '../config/db.js';

const router = express.Router();

function getPublicBaseUrl(req) {
  return (
    process.env.PUBLIC_API_BASE_URL ||
    `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

router.post('/webcam', (req, res, next) => {
  webcamUploadMiddleware(req, res, (error) => {
    if (error) {
      return next(error);
    }

    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file was uploaded.' });
    }

    const relativePath = `/uploads/webcam/${req.file.filename}`;
    let captureRecord = null;
    let warning = '';

    if (isDatabaseConnected()) {
      try {
        captureRecord = await Capture.create({
          userId: String(req.body?.userId || '').trim(),
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          relativePath,
          source: 'webcam',
        });
      } catch {
        warning = 'Image uploaded, but MongoDB metadata could not be stored.';
      }
    }

    return res.status(201).json({
      message: 'Webcam image uploaded successfully.',
      warning,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        relativePath,
        absoluteUrl: `${getPublicBaseUrl(req)}${relativePath}`,
      },
      capture: captureRecord,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload webcam image.' });
  }
});

export default router;

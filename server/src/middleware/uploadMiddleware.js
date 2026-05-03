import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const DEFAULT_WEBCAM_UPLOAD_DIR = path.join(DEFAULT_UPLOAD_ROOT, 'webcam');
const MAX_UPLOAD_FILE_MB = Number(process.env.MAX_UPLOAD_FILE_MB || 8);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function sanitizeSegment(value, fallback = 'capture') {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function getExtensionFromMimeType(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}`;
}

export function getWebcamUploadDirectory() {
  // Try to use the environment variable for the webcam directory
  // This is especially important for cloud deployments (Heroku, Render, etc.)
  // If not set, fall back to the default local directory
  return process.env.WEBCAM_UPLOAD_DIR || process.env.UPLOAD_DIR || DEFAULT_WEBCAM_UPLOAD_DIR;
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const uploadDirectory = getWebcamUploadDirectory();
    fs.mkdirSync(uploadDirectory, { recursive: true });
    callback(null, uploadDirectory);
  },
  filename: (req, file, callback) => {
    const prefix = sanitizeSegment(req.body?.filePrefix, 'webcam');
    const extension = getExtensionFromMimeType(file.mimetype);
    callback(null, `${prefix}-${formatTimestamp()}${extension}`);
  },
});

export const webcamUploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
      return;
    }

    callback(null, true);
  },
}).single('image');

export { multer };

import { memoryStorage } from 'multer';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
];

export const multerConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
};

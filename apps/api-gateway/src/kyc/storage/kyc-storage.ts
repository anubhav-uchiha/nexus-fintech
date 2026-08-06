import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const kycStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/kyc';

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(null, unique + extname(file.originalname));
  },
});

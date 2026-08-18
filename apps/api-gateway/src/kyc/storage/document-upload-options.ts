import { RpcException } from '@nestjs/microservices';
import { memoryStorage } from 'multer';

const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export const documentUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const extension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new RpcException('Only PDF,JPG,JPEG and PNG documents are allowed'),
        false,
      );
    }
    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
      return callback(
        new RpcException(
          'Only .pdf, .jpg, .jpeg and .png documents are allowed',
        ),
        false,
      );
    }
    callback(null, true);
  },
};

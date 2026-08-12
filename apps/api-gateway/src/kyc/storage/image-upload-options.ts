import { RpcException } from '@nestjs/microservices';
import { memoryStorage } from 'multer';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export const imageUploadOptions = {
  storage: memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },

  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const extension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new RpcException({
          statusCode: 400,
          message: 'Only JPG, JPEG and PNG image file are allowed',
        }),
        false,
      );
    }

    if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
      return callback(
        new RpcException({
          statusCode: 400,
          message: 'Only .jpg,.jpeg,.png image files are allowed',
        }),
        false,
      );
    }

    callback(null, true);
  },
};

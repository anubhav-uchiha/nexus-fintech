import { RpcException } from '@nestjs/microservices';
import { memoryStorage } from 'multer';

const ALLOWED_VIDEO_MIME_TYPE = ['video/mp4', 'video/webm', 'video/quicktime'];

const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
export const videoUploadOptions = {
  storage: memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024,
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

    if (!ALLOWED_VIDEO_MIME_TYPE.includes(file.mimetype)) {
      return callback(
        new RpcException({
          statusCode: 400,
          message: 'Only MP4, WebM and MOV video files are allowed',
        }),
        false,
      );
    }

    if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
      return callback(
        new RpcException({
          statusCode: 400,
          message: 'Only .mp4,.webm and .mov video files are allowed',
        }),
        false,
      );
    }

    callback(null, true);
  },
};

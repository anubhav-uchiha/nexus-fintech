import { RpcException } from '@nestjs/microservices';
import { fileTypeFromBuffer } from 'file-type';

export type AllowedFileCategory = 'document' | 'image' | 'video';

const ALLOWED_DOCUMENT_TYPES = new Set(['pdf', 'jpg', 'png']);

const ALLOWED_IMAGE_TYPES = new Set(['jpg', 'png']);

const ALLOWED_VIDEO_TYPES = new Set(['mp4', 'webm', 'mov']);

export async function validateFileContent(
  file: Express.Multer.File,
  category: AllowedFileCategory,
): Promise<void> {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new RpcException({ statusCode: 400, message: 'Invalid file data' });
  }
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected) {
    throw new RpcException({
      statusCode: 400,
      message: 'Unable to determine the actual file type',
    });
  }
  let allowedTypes: Set<string>;
  switch (category) {
    case 'document':
      allowedTypes = ALLOWED_DOCUMENT_TYPES;
      break;
    case 'image':
      allowedTypes = ALLOWED_IMAGE_TYPES;
      break;
    case 'video':
      allowedTypes = ALLOWED_VIDEO_TYPES;
      break;
  }
  if (!allowedTypes.has(detected.ext)) {
    throw new RpcException({
      statusCode: 400,
      message: `Invalid ${category} file content`,
    });
  }
}

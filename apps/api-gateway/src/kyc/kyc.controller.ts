import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';

import { ApiTags } from '@nestjs/swagger';
import { KycGatewayService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';
import { PaginationDto } from '@nexus/common/pagination/dto/pagination.dto';
import { UploadAadharDto } from '@nexus/common/kyc/dto/upload-aadhar-dto';
import { UpdateAadhaarDto } from '@nexus/common/kyc/dto/update-aadhaar.dto';
import { UploadVideoDto } from '@nexus/common/kyc/dto/upload-video.dto';
import { imageUploadOptions } from './storage/image-upload-options';
import { videoUploadOptions } from './storage/video-upload-options';
import { RpcException } from '@nestjs/microservices';
import { S3Service } from '../storage/s3/s3.service';
import { randomUUID } from 'crypto';
import { documentUploadOptions } from './storage/document-upload-options';
import { validateFileContent } from './storage/file-validation';
import { IdempotencyService } from './idempotency/idempotency.service';

@ApiTags('KYC')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycGatewayController {
  constructor(
    private readonly kycGatewayService: KycGatewayService,
    private readonly s3Service: S3Service,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private buildDocumentKey(identityId: string, originalName: string): string {
    return `kyc/${identityId}/documents/${randomUUID()}-${this.safeFileName(originalName)}`;
  }

  private buildAadhaarKey(
    identityId: string,
    side: 'front' | 'back',
    originalName: string,
  ): string {
    return `kyc/${identityId}/aadhaar/${side}/${randomUUID()}-${this.safeFileName(originalName)}`;
  }

  private buildVideoKey(identityId: string, originalName: string): string {
    return `kyc/${identityId}/videos/${randomUUID()}-${this.safeFileName(originalName)}`;
  }

  private safeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  @Post('create')
  create(@Req() req: any) {
    return this.kycGatewayService.create({
      identityId: req.user.sub,
    });
  }

  @Post('submit')
  async submitKyc(
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    const identityId = req.user.sub;
    return this.idempotencyService.execute({
      identityId,
      operation: 'KYC_SUBMIT',
      idempotencyKey,
      payload: {
        identityId,
        operation: 'KYC_SUBMIT',
      },
      handler: () => this.kycGatewayService.submit(identityId),
    });
  }

  @Get('me')
  getMyKyc(@Req() req: any) {
    return this.kycGatewayService.getMyKyc(req.user.sub);
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  async uploadDocument(
    @Req() req: any,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new RpcException({
        statusCode: 400,
        message: 'Document file is required',
      });
    }

    await validateFileContent(file, 'document');

    const identityId = req.user.sub;
    const idempotencyKey = req.headers['idempotency-key'];
    const payload = {
      documentType: dto.documentType,
      documentNumber: dto.documentNumber ?? null,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };

    return this.idempotencyService.execute({
      identityId,
      operation: 'UPLOAD_DOCUMENT',
      idempotencyKey,
      payload,
      handler: async () => {
        const key = this.buildDocumentKey(identityId, file.originalname);

        try {
          await this.s3Service.upload(key, file.buffer, file.mimetype);

          return await this.kycGatewayService.uploadDocument(
            {
              ...dto,
              identityId,
            },
            {
              originalFileName: file.originalname,
              storedFileName: key,
              fileUrl: key,
              mimeType: file.mimetype,
              fileSize: file.size,
            },
          );
        } catch (error) {
          try {
            this.s3Service.delete(key);
          } catch (cleanupError) {
            console.error('Failed to cleanup S3 document:', key, cleanupError);
          }
          throw error;
        }
      },
    });
  }

  @Post('aadhaar')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'frontImage',
          maxCount: 1,
        },
        {
          name: 'backImage',
          maxCount: 1,
        },
      ],
      imageUploadOptions,
    ),
  )
  async uploadAadhaar(
    @Req() req: any,
    @Body() dto: UploadAadharDto,
    @UploadedFiles()
    files: {
      frontImage?: Express.Multer.File[];
      backImage?: Express.Multer.File[];
    },
  ) {
    const frontImage = files?.frontImage?.[0];
    const backImage = files?.backImage?.[0];

    if (!frontImage || !backImage) {
      throw new RpcException({
        statusCode: 400,
        message: 'Both frontImage and backImage are required',
      });
    }
    await validateFileContent(frontImage, 'image');
    await validateFileContent(backImage, 'image');
    const identityId = req.user.sub;
    const idempotencyKey = req.headers['idempotency-key'];

    const payload = {
      documentNumber: dto.documentNumber,
      frontImage: {
        fileName: frontImage.originalname,
        mimeType: frontImage.mimetype,
        fileSize: frontImage.size,
      },
      backImage: {
        fileName: backImage.originalname,
        mimeType: backImage.mimetype,
        fileSize: backImage.size,
      },
    };
    return this.idempotencyService.execute({
      identityId,

      operation: 'UPLOAD_AADHAAR',

      idempotencyKey,

      payload,

      handler: async () => {
        const frontKey = this.buildAadhaarKey(
          identityId,
          'front',
          frontImage.originalname,
        );

        const backKey = this.buildAadhaarKey(
          identityId,
          'back',
          backImage.originalname,
        );

        try {
          await this.s3Service.upload(
            frontKey,
            frontImage.buffer,
            frontImage.mimetype,
          );
          await this.s3Service.upload(
            backKey,
            backImage.buffer,
            backImage.mimetype,
          );

          return await this.kycGatewayService.uploadAadhaar(identityId, {
            ...dto,
            frontImage: {
              originalFileName: frontImage.originalname,
              storedFileName: frontKey,
              fileUrl: frontKey,
              mimeType: frontImage.mimetype,
              fileSize: frontImage.size,
            },
            backImage: {
              originalFileName: backImage.originalname,
              storedFileName: backKey,
              fileUrl: backKey,
              mimeType: backImage.mimetype,
              fileSize: backImage.size,
            },
          });
        } catch (error) {
          try {
            await this.s3Service.delete(frontKey);
          } catch {}

          try {
            await this.s3Service.delete(backKey);
          } catch {}

          throw error;
        }
      },
    });
  }

  @Put('aadhaar')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'frontImage',
          maxCount: 1,
        },
        {
          name: 'backImage',
          maxCount: 1,
        },
      ],
      imageUploadOptions,
    ),
  )
  async updateAadhaar(
    @Req() req: any,
    @Body() dto: UpdateAadhaarDto,
    @UploadedFiles()
    files: {
      frontImage?: Express.Multer.File[];
      backImage?: Express.Multer.File[];
    },
  ) {
    const frontImage = files?.frontImage?.[0];
    const backImage = files?.backImage?.[0];

    if (!dto.documentNumber && !frontImage && !backImage) {
      throw new RpcException({
        statusCode: 400,
        message: 'Provide Aadhaar number, front image, or back image',
      });
    }

    if (frontImage) {
      await validateFileContent(frontImage, 'image');
    }

    if (backImage) {
      await validateFileContent(backImage, 'image');
    }

    const identityId = req.user.sub;

    let frontKey: string | null = null;
    let backKey: string | null = null;

    try {
      if (frontImage) {
        frontKey = this.buildAadhaarKey(
          identityId,
          'front',
          frontImage.originalname,
        );

        await this.s3Service.upload(
          frontKey,
          frontImage.buffer,
          frontImage.mimetype,
        );
      }

      if (backImage) {
        backKey = this.buildAadhaarKey(
          identityId,
          'back',
          backImage.originalname,
        );

        await this.s3Service.upload(
          backKey,
          backImage.buffer,
          backImage.mimetype,
        );
      }
      const result = await this.kycGatewayService.updateAadhaar(identityId, {
        ...dto,
        frontImage: frontImage
          ? {
              originalFileName: frontImage.originalname,
              storedFileName: frontKey!,
              fileUrl: frontKey!,
              mimeType: frontImage.mimetype,
              fileSize: frontImage.size,
            }
          : undefined,

        backImage: backImage
          ? {
              originalFileName: backImage.originalname,
              storedFileName: backKey!,
              fileUrl: backKey!,
              mimeType: backImage.mimetype,
              fileSize: backImage.size,
            }
          : undefined,
      });
      return result;
    } catch (error) {
      if (frontKey) {
        try {
          await this.s3Service.delete(frontKey);
        } catch {}
      }

      if (backKey) {
        try {
          await this.s3Service.delete(backKey);
        } catch {}
      }

      throw error;
    }
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', videoUploadOptions))
  async uploadVideo(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
  ) {
    if (!file) {
      throw new RpcException({
        statusCode: 400,
        message: 'Video is required',
      });
    }

    await validateFileContent(file, 'video');
    const identityId = req.user.sub;

    const idempotencyKey = req.headers['idempotency-key'];

    const payload = {
      ...dto,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
    return this.idempotencyService.execute({
      identityId,

      operation: 'UPLOAD_VIDEO',

      idempotencyKey,

      payload,

      handler: async () => {
        const key = this.buildVideoKey(identityId, file.originalname);

        try {
          await this.s3Service.upload(key, file.buffer, file.mimetype);
          return await this.kycGatewayService.uploadVideo(identityId, dto, {
            originalFileName: file.originalname,
            storedFileName: key,
            fileUrl: key,
            mimeType: file.mimetype,
            fileSize: file.size,
          });
        } catch (error) {
          try {
            await this.s3Service.delete(key);
          } catch {}

          throw error;
        }
      },
    });
  }

  @Get('me/documents')
  getDocuments(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.kycGatewayService.getDocuments(
      req.user.sub,
      pagination.page,
      pagination.limit,
    );
  }

  @Put('document')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  async updateDocument(
    @Req() req: any,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const identityId = req.user.sub;

    const idempotencyKey = req.headers['idempotency-key'];
    return this.idempotencyService.execute({
      identityId,
      operation: 'UPDATE_DOCUMENT',
      idempotencyKey,
      payload: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber ?? null,
        fileName: file?.originalname ?? null,
        mimeType: file?.mimetype ?? null,
        fileSize: file?.size ?? null,
      },

      handler: async () => {
        if (!file && !dto.documentNumber?.trim()) {
          throw new RpcException({
            statusCode: 400,
            message: 'Document number or document file is required',
          });
        }

        let key: string | null = null;

        try {
          if (file) {
            await validateFileContent(file, 'document');
            key = this.buildDocumentKey(identityId, file.originalname);

            await this.s3Service.upload(key, file.buffer, file.mimetype);

            return await this.kycGatewayService.updateDocument(
              {
                ...dto,
                identityId,
              },
              {
                originalFileName: file.originalname,
                storedFileName: key,
                fileUrl: key,
                mimeType: file.mimetype,
                fileSize: file.size,
              },
            );
          }

          return await this.kycGatewayService.updateDocument(
            {
              ...dto,
              identityId,
            },
            undefined,
          );
        } catch (error) {
          if (key) {
            try {
              await this.s3Service.delete(key);
            } catch (cleanupError) {
              console.error(
                'Failed to cleanup new S3 document:',
                key,
                cleanupError,
              );
            }
          }

          throw error;
        }
      },
    });
  }

  @Delete('document/:documentId')
  deleteDocument(@Req() req: any, @Param('documentId') documentId: string) {
    return this.kycGatewayService.deleteDocument(documentId, req.user.sub);
  }

  @Delete('video/:videoId')
  deleteVideo(@Req() req: any, @Param('videoId') videoId: string) {
    return this.kycGatewayService.deleteVideo(videoId, req.user.sub);
  }
}

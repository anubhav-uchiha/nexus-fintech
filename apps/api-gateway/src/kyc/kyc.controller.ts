import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import { KycGatewayService } from './kyc.service';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';
import { kycStorage } from './storage/kyc-storage';
import { PaginationDto } from '@nexus/common/pagination/dto/pagination.dto';

@ApiTags('KYC')
@Controller('kyc')
export class KycGatewayController {
  constructor(private readonly kycGatewayService: KycGatewayService) {}
  @Post('create')
  create(@Body() dto: CreateKycDto) {
    console.log('STEP 1 CONTROLLER');
    return this.kycGatewayService.create(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyKyc(@Req() req: any) {
    return this.kycGatewayService.getMyKyc(req.user.sub);
  }

  @Get(':identityId')
  getByIdentity(@Param('identityId') identityId: string) {
    return this.kycGatewayService.getMyKyc(identityId);
  }

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: kycStorage,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.kycGatewayService.uploadDocument(dto, file);
  }

  @Get(':identityId/documents')
  getDocuments(
    @Param('identityId') identityId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.kycGatewayService.getDocuments(
      identityId,
      pagination.page,
      pagination.limit,
    );
  }
}

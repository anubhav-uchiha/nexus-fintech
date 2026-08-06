import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateKycDto } from '@nexus/common/kyc/dto/create-kyc.dto';
import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';
import { KycService } from './kyc.service';
import { UploadDocumentDto } from '@nexus/common/kyc/dto/upload-document.dto';

@Controller()
export class KycKafkaController {
  constructor(private readonly kycService: KycService) {
    console.log('KYC kafka controller.loaded');
  }

  @MessagePattern(KYC_PATTERNS.CREATE_KYC)
  async createKyc(@Payload() dto: CreateKycDto) {
    console.log(' Message RECIEIVED:');
    console.log(dto);
    return await this.kycService.create(dto);
  }

  @MessagePattern(KYC_PATTERNS.GET_MY_KYC)
  getMyKyc(@Payload() identityId: string) {
    return this.kycService.getMyKyc(identityId);
  }

  @MessagePattern(KYC_PATTERNS.UPLOAD_DOCUMENT)
  uploadDocument(@Payload() payload: UploadDocumentDto) {
    return this.kycService.uploadDocument(payload);
  }

  @MessagePattern(KYC_PATTERNS.GET_DOCUMENTS)
  getDocuments(
    @Payload()
    payload: {
      identityId: string;
      page: number;
      limit: number;
    },
  ) {
    return this.kycService.getDocuments(
      payload.identityId,
      Number(payload.page),
      Number(payload.limit),
    );
  }
}

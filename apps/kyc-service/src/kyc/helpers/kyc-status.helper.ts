import { RpcException } from '@nestjs/microservices';
import { KycStatus } from 'apps/kyc-service/generated/kyc-prisma/enums';

export function ensureKycEditable(status: KycStatus): void {
  if (status === KycStatus.UNDER_REVIEW || status === KycStatus.APPROVED) {
    throw new RpcException({
      statusCode: 400,
      message: 'KYC cannot be modified after submission',
    });
  }
}

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { OnboardEkoUserDto } from '@nexus/common/aeps/dto/OnboardEkoUserDto';
import { EkoClientService } from './eko-client.service';
import { ConfigService } from '@nestjs/config';
import { AepsMerchantProfileService } from '../../merchant-profile/aeps-merchant-profile.service';
import { OnboardEkoMerchantCommandDto } from '@nexus/common/aeps/dto/onboard-eko-merchant-command.dto';

interface EkoOnboardingResponse {
  response_status_id?: number;
  response_type_id?: number;
  status?: number;
  message?: string;

  data?: {
    user_code?: string | number;
    initiator_id?: string | number;
    merchant_id?: string | number;
  };
}

@Injectable()
export class EkoService {
  constructor(
    private readonly ekoClient: EkoClientService,
    private readonly configService: ConfigService,
    private readonly merchantProfileService: AepsMerchantProfileService,
  ) {}
  async getAllServices() {
    const initiatorId =
      this.configService.getOrThrow<string>('EKO_INITIATOR_ID');

    return this.ekoClient.get('/tools/catalog/service-codes', {
      initiator_id: initiatorId,
    });
  }

  async onboardUser(dto: OnboardEkoMerchantCommandDto) {
    const { profile, shouldCallProvider } =
      await this.merchantProfileService.prepareEkoOnboarding(dto.identityId);

    if (!shouldCallProvider) {
      return {
        success: true,
        alreadyOnboarded: true,
        message: 'Eko merchant onboarding already completed',
        provider: 'EKO',
        providerUserCode: profile.providerUserCode,
        profile,
      };
    }

    if (!profile.onboardingClientRefId) {
      throw new BadGatewayException(
        'AEPS onboarding client reference was not generated',
      );
    }

    const initiatorId =
      this.configService.getOrThrow<string>('EKO_INITIATOR_ID');

    const onboardingPath =
      this.configService.get<string>('EKO_ONBOARD_USER_PATH') ??
      '/user/network/eps-agent';

    const response = await this.ekoClient.post<EkoOnboardingResponse>(
      onboardingPath,
      {
        initiator_id: initiatorId,
        client_ref_id: profile.onboardingClientRefId,
        pan_number: dto.pan_number,
        mobile: dto.mobile,
        first_name: dto.first_name,
        last_name: dto.last_name,
        residence_address: dto.residence_address,
        email: dto.email,
        shop_name: dto.shop_name,
        dob: dto.dob,
      },
    );

    if (response.status !== 0) {
      const rejectionReason =
        response.message ?? 'Eko merchant onboarding was rejected';

      await this.merchantProfileService.markEkoOnboardingRejected(
        dto.identityId,
        rejectionReason,
      );

      throw new BadRequestException({
        message: rejectionReason,
        provider: 'EKO',
        providerResponseTypeId: response.response_type_id,
      });
    }

    const providerUserCode = response.data?.user_code;

    if (providerUserCode === undefined || providerUserCode === null) {
      throw new BadGatewayException(
        'Eko onboarding response did not contain user_code',
      );
    }

    const providerMerchantId = response.data?.merchant_id;

    const updatedProfile =
      await this.merchantProfileService.markEkoOnboardingCompleted(
        dto.identityId,
        String(providerUserCode),
        providerMerchantId !== undefined
          ? String(providerMerchantId)
          : undefined,
      );

    return {
      success: true,
      alreadyOnboarded: false,
      message: response.message ?? 'Eko merchant onboarding completed',
      provider: 'EKO',
      providerUserCode: String(providerUserCode),
      profile: updatedProfile,
    };
  }
}

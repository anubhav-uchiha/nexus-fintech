import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VIMOPAY_ENDPOINTS } from './constants/vimopay.constants';
import {
  VimopayAuthorizeResult,
  VimopayEncryptedResponse,
} from './interfaces/vimopay-response.interface';
import { VimopayClientService } from './vimopay-client.service';

@Injectable()
export class VimopayAuthService {
  private bearerToken: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly client: VimopayClientService,
  ) {}

  async authorize(): Promise<VimopayAuthorizeResult> {
    const headers = this.getPartnerAuthorizationHeaders();

    const response = await this.client.post<VimopayEncryptedResponse>(
      VIMOPAY_ENDPOINTS.AUTHORIZE,
      undefined,
      {
        headers,
      },
    );

    if (!response.successStatus || response.responseCode !== '000') {
      this.bearerToken = null;

      throw new UnauthorizedException({
        message: response.message || 'VimoPay partner authorization failed',
        responseCode: response.responseCode,
      });
    }

    /*
     * IMPORTANT:
     *
     * Partner Authorization API ka response.data
     * encrypted business payload nahi hai.
     *
     * Ye directly Bearer Token hai.
     *
     * PDF ke next APIs mein isi token ko:
     *
     * Authorization: Bearer <token>
     *
     * ke form mein pass karna hai.
     */
    const token = typeof response.data === 'string' ? response.data.trim() : '';

    if (!token) {
      this.bearerToken = null;

      throw new InternalServerErrorException(
        'VimoPay authorization succeeded but bearer token was not received',
      );
    }

    this.bearerToken = token;

    return {
      success: true,
      responseCode: response.responseCode,
      message: response.message,
      tokenReceived: true,
    };
  }

  async getBearerToken(forceRefresh = false): Promise<string> {
    if (this.bearerToken && !forceRefresh) {
      return this.bearerToken;
    }

    await this.authorize();

    if (!this.bearerToken) {
      throw new UnauthorizedException('Unable to obtain VimoPay bearer token');
    }

    return this.bearerToken;
  }

  clearToken(): void {
    this.bearerToken = null;
  }

  async getAuthenticatedHeaders(): Promise<Record<string, string>> {
    const token = await this.getBearerToken();

    const userId = this.getRequiredConfig('AEPS_VIMO_USER_ID');

    return {
      Authorization: `Bearer ${token}`,
      userId,
    };
  }

  private getPartnerAuthorizationHeaders(): Record<string, string> {
    return {
      secretKey: this.getRequiredConfig('AEPS_VIMO_SECRET_KEY'),

      saltKey: this.getRequiredConfig('AEPS_VIMO_SALT_KEY'),

      encryptdecryptKey: this.getRequiredConfig(
        'AEPS_VIMO_ENCRYPT_DECRYPT_KEY',
      ),

      userId: this.getRequiredConfig('AEPS_VIMO_USER_ID'),
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }

    return value;
  }
}

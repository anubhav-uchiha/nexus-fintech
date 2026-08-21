import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecretKeyAndSecretTimeStamp } from './helpers/generateSecretKeyAndTimeStamp';

type QueryValue = string | number | boolean | undefined;

@Injectable()
export class EkoClientService {
  private readonly logger = new Logger(EkoClientService.name);
  private readonly baseUrl: string;
  private readonly developerKey: string;
  private readonly accessKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    // this.baseUrl = this.configService
    //   .getOrThrow<string>('EKO_BASE_URL')
    //   .replace(/\/+$/, '');
    // this.developerKey =
    //   this.configService.getOrThrow<string>('EKO_DEVELOPER_KEY');
    // this.accessKey = this.configService.getOrThrow<string>('EKO_ACCESS_KEY');
    // const configuredTimeout = Number(
    //   this.configService.get<string>('EKO_REQUEST_TIMEOUT_MS') ?? 15000,
    // );
    // this.timeoutMs =
    //   Number.isFinite(configuredTimeout) && configuredTimeout > 0
    //     ? configuredTimeout
    //     : 15000;

    this.baseUrl = this.getRequiredConfig('EKO_BASE_URL').replace(/\/+$/, '');

    this.developerKey = this.getRequiredConfig('EKO_DEVELOPER_KEY');
    this.accessKey = this.getRequiredConfig('EKO_ACCESS_KEY');

    const configuredTimeout = Number(
      this.configService.get<string>('EKO_REQUEST_TIMEOUT_MS') ?? 15000,
    );

    this.timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 15000;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const { secretKey, secretKeyTimestamp } =
      generateSecretKeyAndSecretTimeStamp(this.accessKey);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          developer_key: this.developerKey,
          'secret-key': secretKey,
          'secret-key-timestamp': secretKeyTimestamp,
          accept: 'application/json',
          ...(body && {
            'content-type': 'application/json',
          }),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const responseText = await response.text();
      const responseBody = this.parseResponseText(responseText);

      this.logger.log(
        `Eko ${method} ${normalizedPath} returned HTTP ${response.status}, ` +
          `contentType=${response.headers.get('content-type') ?? 'unknown'}, ` +
          `responseBytes=${Buffer.byteLength(responseText, 'utf8')}`,
      );

      if (!response.ok) {
        this.logger.warn(
          `Eko ${method} ${normalizedPath} returned HTTP ${response.status}`,
        );
        throw new BadGatewayException({
          message:
            this.extractProviderMessage(responseBody) ??
            'Eko API request failed',
          provider: 'EKO',
          providerStatusCode: response.status,
        });
      }
      if (!responseText.trim()) {
        throw new BadGatewayException({
          message: 'Eko returned an empty response',
          provider: 'EKO',
          providerStatusCode: response.status,
        });
      }
      return responseBody as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const details = this.getSafeErrorDetails(error);

      this.logger.error(
        `Eko ${method} ${normalizedPath} request failed: ${details}`,
      );

      throw new ServiceUnavailableException(
        'Eko service is currently unavailable',
      );
    }
  }

  private parseResponseText(text: string): unknown {
    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private extractProviderMessage(responseBody: unknown): string | null {
    if (typeof responseBody === 'string') {
      return responseBody.slice(0, 500);
    }

    if (typeof responseBody !== 'object' || responseBody === null) {
      return null;
    }

    const body = responseBody as Record<string, unknown>;

    const possibleMessages = [
      body.message,
      body.response_message,
      body.message_text,
      body.error,
    ];

    const message = possibleMessages.find((value) => typeof value === 'string');

    return typeof message === 'string' ? message.slice(0, 500) : null;
  }

  private getRequiredConfig(name: string): string {
    const value = this.configService.get<string>(name)?.trim();

    if (!value) {
      throw new Error(`${name} is required`);
    }
    return value;
  }

  private getSafeErrorDetails(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Unknown Error';
    }

    const cause = (
      error as Error & {
        cause?: { code?: string; message?: string };
      }
    ).cause;
    return [error.name, error.message, cause?.code, cause?.message]
      .filter(Boolean)
      .join(' | ');
  }
}

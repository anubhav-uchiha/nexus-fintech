import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

@Injectable()
export class VimopayClientService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('AEPS_VIMO_BASE_URL');

    if (!baseUrl) {
      throw new InternalServerErrorException(
        'AEPS_VIMO_BASE_URL is not configured',
      );
    }

    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async get<T>(
    path: string,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<T> {
    return this.request<T>('POST', path, {
      ...options,
      body,
    });
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const controller = new AbortController();

    const timeoutMs =
      options.timeoutMs ??
      this.configService.get<number>('AEPS_VIMO_TIMEOUT_MS') ??
      30000;

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body:
          method === 'POST' && options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
        signal: controller.signal,
      });

      const rawResponse = await response.text();

      let responseData: unknown;

      try {
        responseData = rawResponse ? JSON.parse(rawResponse) : {};
      } catch {
        responseData = {
          message: rawResponse || 'Invalid response from VimoPay',
        };
      }

      if (!response.ok) {
        throw new BadGatewayException({
          message: 'VimoPay API request failed',
          providerStatusCode: response.status,
          providerResponse: responseData,
        });
      }

      return responseData as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException('VimoPay API request timed out');
      }

      if (
        error instanceof BadGatewayException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      throw new BadGatewayException({
        message: 'Unable to connect to VimoPay gateway',
        error:
          error instanceof Error ? error.message : 'Unknown provider error',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

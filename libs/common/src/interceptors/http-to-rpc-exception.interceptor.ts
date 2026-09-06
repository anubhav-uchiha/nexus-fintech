import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';

import { RpcException } from '@nestjs/microservices';

import { catchError, Observable, throwError } from 'rxjs';

type ExceptionMessage = string | string[] | Record<string, unknown>;

type RpcErrorPayload = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

interface RpcExceptionPayload {
  statusCode: number;
  message: ExceptionMessage;
  error?: string;
  errorCode?: string;
  errors?: unknown;
}

@Injectable()
export class HttpToRpcExceptionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpToRpcExceptionInterceptor.name);

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    // Only convert exceptions for Kafka/microservice requests.
    // HTTP routes exposed directly by the service remain unchanged.
    // if (context.getType() !== 'rpc') {
    //   return next.handle();
    // }

    return next.handle().pipe(
      catchError((error: unknown) => {
        // Existing RpcException and ApiError instances already have
        // the correct transport-level format.
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        if (error instanceof HttpException) {
          const statusCode = error.getStatus();
          const response = error.getResponse();
          const payload: RpcErrorPayload =
            typeof response === 'string'
              ? {
                  statusCode,
                  message: response,
                  error: error.name,
                }
              : {
                  statusCode,
                  message: this.readMessage(response) ?? error.message,
                  error: this.readString(response, 'error') ?? error.name,
                };

          return throwError(() => new RpcException(payload));
        }

        const serializedError = this.extractSerializedError(error);

        if (serializedError) {
          return throwError(() => new RpcException(serializedError));
        }

        this.logger.error(
          `Unhandled microservice error: ${this.describeError(error)}`,
        );

        return throwError(
          () =>
            new RpcException({
              statusCode: 500,
              message: 'Internal server error',
              error: 'Internal Server Error',
            }),
        );
      }),
    );
  }

  private extractSerializedError(error: unknown): RpcErrorPayload | null {
    const candidates: unknown[] = [error];

    if (this.isRecord(error)) {
      candidates.push(error.response, error.err, error.cause);
    }

    for (const candidate of candidates) {
      if (!this.isRecord(candidate)) {
        continue;
      }

      const statusCode = candidate.statusCode;
      const message = this.readMessage(candidate);

      if (
        typeof statusCode === 'number' &&
        statusCode >= 400 &&
        statusCode <= 599 &&
        message
      ) {
        return {
          statusCode,
          message,
          ...(this.readString(candidate, 'error') && {
            error: this.readString(candidate, 'error'),
          }),
        };
      }
    }

    return null;
  }

  private readMessage(value: unknown): string | string[] | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const message = value.message;

    if (typeof message === 'string') {
      return message;
    }

    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message;
    }

    return null;
  }

  private readString(value: unknown, key: string): string | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const property = value[key];

    return typeof property === 'string' ? property : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}

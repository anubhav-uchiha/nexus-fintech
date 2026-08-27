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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only convert exceptions for Kafka/microservice requests.
    // HTTP routes exposed directly by the service remain unchanged.
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error: unknown) => {
        // Existing RpcException and ApiError instances already have
        // the correct transport-level format.
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        if (error instanceof HttpException) {
          const payload = this.convertHttpException(error);

          return throwError(() => new RpcException(payload));
        }

        const message =
          error instanceof Error ? error.message : 'Unknown microservice error';

        this.logger.error(
          `Unhandled microservice error: ${message}`,
          error instanceof Error ? error.stack : undefined,
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

  private convertHttpException(exception: HttpException): RpcExceptionPayload {
    const statusCode = exception.getStatus();

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        statusCode,
        message: response,
      };
    }

    const responseBody = response as Record<string, unknown>;

    const message = this.normalizeMessage(
      responseBody.message,
      exception.message,
    );

    return {
      statusCode,
      message,

      ...(typeof responseBody.error === 'string' && {
        error: responseBody.error,
      }),

      ...(typeof responseBody.errorCode === 'string' && {
        errorCode: responseBody.errorCode,
      }),

      ...(responseBody.errors !== undefined && {
        errors: responseBody.errors,
      }),
    };
  }

  private normalizeMessage(value: unknown, fallback: string): ExceptionMessage {
    if (typeof value === 'string') {
      return value;
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    ) {
      return value;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return fallback;
  }
}

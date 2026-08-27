import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { catchError, Observable, throwError } from 'rxjs';

type ExceptionMessage = string | string[] | Record<string, unknown>;

interface RpcErrorPayload {
  statusCode: number;
  message: ExceptionMessage;
  error?: string;
  errorCode?: string;
  errors?: unknown;
<<<<<<< Updated upstream
  stack?: string;
=======
>>>>>>> Stashed changes
}

@Injectable()
export class RpcToHttpExceptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
<<<<<<< Updated upstream
        const payload = this.extractRpcError(error);

        if (payload) {
          const response: Record<string, unknown> = {
            statusCode: payload.statusCode,
            message: payload.message,
          };

          if ('error' in payload) {
            response.error = payload.error;
          }

          if ('errorCode' in payload) {
            response.errorCode = payload.errorCode;
          }

          if ('errors' in payload) {
            response.errors = payload.errors;
          }

          if (
            process.env.NODE_ENV === 'development' &&
            typeof payload.stack === 'string'
          ) {
            response.stack = payload.stack;
          }

          return throwError(
            () => new HttpException(response, payload.statusCode),
          );
=======
        // Exceptions created directly in the gateway are already
        // HTTP exceptions and do not need conversion.
        if (error instanceof HttpException) {
          return throwError(() => error);
>>>>>>> Stashed changes
        }

        const payload = this.extractRpcError(error);

        if (!payload) {
          return throwError(() => error);
        }

        return throwError(
          () =>
            new HttpException(
              {
                statusCode: payload.statusCode,

                message: payload.message,

                ...(payload.error && {
                  error: payload.error,
                }),

                ...(payload.errorCode && {
                  errorCode: payload.errorCode,
                }),

                ...(payload.errors !== undefined && {
                  errors: payload.errors,
                }),
              },

              payload.statusCode,
            ),
        );
      }),
    );
  }

  private extractRpcError(error: unknown): RpcErrorPayload | null {
    if (this.isRpcError(error)) {
      return error;
    }

    if (typeof error !== 'object' || error === null) {
      return null;
    }

    if ('message' in error && this.isRpcError(error.message)) {
      return error.message;
    }

    if ('response' in error && this.isRpcError(error.response)) {
      return error.response;
    }

    if ('error' in error && this.isRpcError(error.error)) {
      return error.error;
    }

    return null;
  }

  private isRpcError(value: unknown): value is RpcErrorPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      'statusCode' in value &&
      typeof value.statusCode === 'number' &&
      'message' in value
    );
  }
}

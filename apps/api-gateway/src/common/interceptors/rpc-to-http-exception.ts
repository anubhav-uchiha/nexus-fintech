import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';

interface RpcErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
  errors?: unknown;
  stack?: string;
}

@Injectable()
export class RpcToHttpExceptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
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
        }

        return throwError(() => error);
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

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
}

@Injectable()
export class RpcToHttpExceptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const payload = this.extractRpcError(error);

        if (payload) {
          return throwError(
            () =>
              new HttpException(
                {
                  statusCode: payload.statusCode,
                  message: payload.message,
                  ...(payload.error && {
                    error: payload.error,
                  }),
                },
                payload.statusCode,
              ),
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

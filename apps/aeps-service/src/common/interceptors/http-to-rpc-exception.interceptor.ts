import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class HttpToRpcExceptionInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        if (error instanceof HttpException) {
          const statusCode = error.getStatus();
          const response = error.getResponse();

          const payload: Record<string, unknown> =
            typeof response === 'string'
              ? { message: response }
              : response && typeof response === 'object'
                ? (response as Record<string, unknown>)
                : { message: error.message };

          return throwError(
            () =>
              new RpcException({
                ...payload,
                statusCode,
              }),
          );
        }

        return throwError(
          () =>
            new RpcException({
              statusCode: 500,
              message: 'Internal server error',
            }),
        );
      }),
    );
  }
}

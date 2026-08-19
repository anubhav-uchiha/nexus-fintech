import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable()
export class HttpToRpcExceptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpException) {
          const response = error.getResponse();

          const message =
            typeof response === 'string'
              ? response
              : ((
                  response as {
                    message?: string | string[];
                  }
                ).message ?? error.message);

          const errorName =
            typeof response === 'object' &&
            response !== null &&
            'error' in response
              ? String(response.error)
              : error.name;

          return throwError(
            () =>
              new RpcException({
                statusCode: error.getStatus(),
                message,
                error: errorName,
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}

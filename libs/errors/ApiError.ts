import { RpcException } from '@nestjs/microservices';

export class ApiError extends RpcException {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly errors: unknown;

  constructor(
    statusCode = 500,
    message = 'Internal server error',
    errors: any = null,
    code = 'INTERNAL_SERVER_ERROR',
  ) {
    const finalStatusCode = statusCode >= 400 ? statusCode : 500;
    const payload: {
      statusCode: number;
      message: string;
      errorCode: string;
      errors: unknown;
      stack?: string;
    } = {
      statusCode: finalStatusCode,
      message,
      errorCode: code,
      errors,
    };

    super(payload);

    if (process.env.NODE_ENV === 'development' && this.stack) {
      payload.stack = this.stack;
    }

    this.statusCode = finalStatusCode;
    this.errorCode = code;
    this.errors = errors;
  }
}

export class NotFoundError extends ApiError {
  constructor(
    message = 'Resource not found',
    errors: unknown = null,
    code = 'NOT_FOUND',
  ) {
    super(404, message, errors, code);
  }
}

export class BadRequestError extends ApiError {
  constructor(
    message = 'Bad Request',
    errors: any = null,
    code = 'BAD_REQUEST',
  ) {
    super(400, message, errors, code);
  }
}

export class ForbiddenError extends ApiError {
  constructor(
    message = 'Forbidden',
    errors: unknown = null,
    code = 'FORBIDDEN',
  ) {
    super(403, message, errors, code);
  }
}

export class ConflictError extends ApiError {
  constructor(
    message = 'Resource conflict',
    errors: unknown = null,
    code = 'RESOURCE_CONFLICT',
  ) {
    super(409, message, errors, code);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(
    message = 'Unauthorized',
    errors: unknown = null,
    code = 'UNAUTHORIZED',
  ) {
    super(401, message, errors, code);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(
    message = 'Too Many Requests',
    errors: unknown = null,
    code = 'TOO_MANY_REQUESTS',
  ) {
    super(429, message, errors, code);
  }
}

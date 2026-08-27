import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import { RpcToHttpExceptionInterceptor } from './rpc-to-http-exception';

describe('RpcToHttpExceptionInterceptor', () => {
  const interceptor = new RpcToHttpExceptionInterceptor();
  const context = {} as ExecutionContext;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  const interceptError = async (error: unknown) => {
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    try {
      await lastValueFrom(interceptor.intercept(context, next));
      throw new Error('Expected the observable to reject');
    } catch (caught) {
      return caught;
    }
  };

  it('preserves the complete direct RPC error payload', async () => {
    const payload = {
      statusCode: 400,
      message: 'Bank account already attached.',
      errorCode: 'BANK_ACCOUNT_ALREADY_ATTACHED',
      errors: 'account already attached',
    };

    const error = await interceptError(payload);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect((error as HttpException).getResponse()).toEqual(payload);
  });

  it.each([
    { errors: { verificationStatus: 'failed' } },
    { errors: ['first error', 'second error'] },
    { errors: null },
  ])('preserves structured or null error details: %p', async ({ errors }) => {
    const payload = {
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BANK_ACCOUNT_NOT_VALID',
      errors,
    };

    const error = await interceptError({ message: payload });

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toEqual(payload);
  });

  it('extracts an RPC payload wrapped in a response property', async () => {
    const payload = {
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BANK_ACCOUNT_NOT_VALID',
      errors: { verificationStatus: 'failed' },
    };

    const error = await interceptError({ response: payload });

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toEqual(payload);
  });

  it('exposes a bank-service stack in development', async () => {
    process.env.NODE_ENV = 'development';
    const payload = {
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BANK_ACCOUNT_NOT_VALID',
      errors: null,
      stack: 'BadRequestError: Invalid bank account.\n    at bank-service',
    };

    const error = await interceptError(payload);

    expect((error as HttpException).getResponse()).toEqual(payload);
  });

  it('removes a bank-service stack in production', async () => {
    process.env.NODE_ENV = 'production';
    const payload = {
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BANK_ACCOUNT_NOT_VALID',
      errors: null,
      stack: 'BadRequestError: Invalid bank account.\n    at bank-service',
    };

    const error = await interceptError(payload);

    expect((error as HttpException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BANK_ACCOUNT_NOT_VALID',
      errors: null,
    });
  });

  it('passes unrelated errors through unchanged', async () => {
    const originalError = new Error('unexpected failure');

    await expect(interceptError(originalError)).resolves.toBe(originalError);
  });
});

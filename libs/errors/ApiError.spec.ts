import { BadRequestError } from './ApiError';

describe('BadRequestError', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('stores the complete structured RPC error payload', () => {
    process.env.NODE_ENV = 'production';

    const error = new BadRequestError(
      'Bank account already attached.',
      'account already attached',
      'BANK_ACCOUNT_ALREADY_ATTACHED',
    );

    expect(error.getError()).toEqual({
      statusCode: 400,
      message: 'Bank account already attached.',
      errorCode: 'BANK_ACCOUNT_ALREADY_ATTACHED',
      errors: 'account already attached',
    });
  });

  it('includes its stack in development', () => {
    process.env.NODE_ENV = 'development';

    const error = new BadRequestError('Invalid bank account.');

    expect(error.getError()).toEqual({
      statusCode: 400,
      message: 'Invalid bank account.',
      errorCode: 'BAD_REQUEST',
      errors: null,
      stack: expect.any(String),
    });
  });

  it('does not include its stack in production', () => {
    process.env.NODE_ENV = 'production';

    const error = new BadRequestError('Invalid bank account.');

    expect(error.getError()).not.toHaveProperty('stack');
  });
});

export interface EkoHttpError {
  success: false;
  status: 'RETRYABLE' | 'FAILED';
  errorType: 'HTTP';
  errorCode: number;
  errorMessage: string;
  httpStatus: number;
  httpStatusText: string;
  rawResponse?: unknown;
}

export class EkoHttpResponseHandler {
  static handle(response: Response): EkoHttpError | null {
    /**
     * HTTP success.
     *
     * Return null so the caller knows it is safe
     * to continue with response.json().
     */
    if (response.ok) {
      return null;
    }

    return this.handleError(response);
  }

  private static handleError(response: Response): EkoHttpError {
    const status = response.status;

    switch (status) {
      case 400:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 400,
          errorMessage: 'Bad request sent to Eko',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 401:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 401,
          errorMessage: 'Eko authentication failed',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 402:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 402,
          errorMessage: 'Eko returned Payment Required',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 403:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 403,
          errorMessage:
            'Eko authorization failed. Check developer key, secret key and timestamp.',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 404:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 404,
          errorMessage: 'Eko endpoint not found',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 405:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 405,
          errorMessage: 'HTTP method not allowed by Eko',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 415:
        return {
          success: false,
          status: 'FAILED',
          errorType: 'HTTP',
          errorCode: 415,
          errorMessage: 'Unsupported media type sent to Eko',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 429:
        return {
          success: false,
          status: 'RETRYABLE',
          errorType: 'HTTP',
          errorCode: 429,
          errorMessage: 'Eko rate limit exceeded',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 500:
        return {
          success: false,
          status: 'RETRYABLE',
          errorType: 'HTTP',
          errorCode: 500,
          errorMessage: 'Eko internal server error',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 502:
        return {
          success: false,
          status: 'RETRYABLE',
          errorType: 'HTTP',
          errorCode: 502,
          errorMessage: 'Bad gateway received from Eko',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 503:
        return {
          success: false,
          status: 'RETRYABLE',
          errorType: 'HTTP',
          errorCode: 503,
          errorMessage: 'Eko service is temporarily unavailable',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      case 504:
        return {
          success: false,
          status: 'RETRYABLE',
          errorType: 'HTTP',
          errorCode: 504,
          errorMessage: 'Eko request timed out at gateway',
          httpStatus: status,
          httpStatusText: response.statusText,
        };

      default:
        return {
          success: false,
          status: status >= 500 ? 'RETRYABLE' : 'FAILED',

          errorType: 'HTTP',

          errorCode: status,

          errorMessage: `Unexpected HTTP error from Eko: ${status}`,

          httpStatus: status,

          httpStatusText: response.statusText,
        };
    }
  }
}

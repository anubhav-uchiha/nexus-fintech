import { BadRequestError } from 'libs/errors/ApiError';
import { generateSecretKeyAndSecretTimeStamp } from './generateSecretKeyAndTimeStamp';
import { EkoHttpResponseHandler } from './eko-http-response.handler';

export async function callEkoGetService(url: string) {
  try {
    const developerKey = process.env.EKO_DEVELOPER_KEY;
    const accessKey = process.env.EKO_KEY;
    const baseUrl = process.env.EKO_BASE_URL;
    if (!baseUrl) {
      throw new Error('developer key is required for eko client connection');
    }
    if (!developerKey) {
      throw new Error('developer key is required for eko client connection');
    }
    if (!accessKey) {
      throw new Error('access key is required for eko client connection');
    }
    const { secretKey, secretKeyTimestamp } =
      generateSecretKeyAndSecretTimeStamp(accessKey);
    const apiUrl = `${baseUrl}${url}`;
    const response = await fetch(apiUrl, {
      headers: {
        developer_key: developerKey,
        'secret-key': secretKey,
        'secret-key-timestamp': secretKeyTimestamp,
      },
    });

    const httpError = EkoHttpResponseHandler.handle(response);

    if (httpError) {
      return httpError;
    }
    return response.json();
  } catch (error) {
    console.log('error while calling get eko service api :', error);
    throw new BadRequestError('Eko Get Api failed to respond', error);
  }
}
export async function callEkoPostService(url: string, body: any) {
  try {
    const developerKey = process.env.EKO_DEVELOPER_KEY;
    const accessKey = process.env.EKO_KEY;
    const baseUrl = process.env.EKO_BASE_URL;
    if (!baseUrl) {
      throw new Error('developer key is required for eko client connection');
    }
    if (!developerKey) {
      throw new Error('developer key is required for eko client connection');
    }
    if (!accessKey) {
      throw new Error('access key is required for eko client connection');
    }
    const { secretKey, secretKeyTimestamp } =
      generateSecretKeyAndSecretTimeStamp(accessKey);
    const apiUrl = `${baseUrl}${url}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        developer_key: developerKey,
        'secret-key': secretKey,
        'secret-key-timestamp': secretKeyTimestamp,
        'Content-Type': 'application/json',
        redirect: 'follow',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const httpError = EkoHttpResponseHandler.handle(response);

    if (httpError) {
      return httpError;
    }
    return response.json();
  } catch (error) {
    console.log(error);
    throw new BadRequestError('Eko post Api failed to respond', error);
  }
}

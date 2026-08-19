import { BadRequestError } from 'libs/errors/ApiError';
import { generateSecretKeyAndSecretTimeStamp } from './generateSecretKeyAndTimeStamp';
import { RpcException } from '@nestjs/microservices';

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
      method: 'GET',
      headers: {
        'developer-key': developerKey,
        'secret-key': secretKey,
        'secret-key-timestamp': secretKeyTimestamp,
      },
    });
    console.log(response);
    if (!response.ok) {
      throw new BadRequestError('get api failed', response);
    }
    return response.json();
  } catch (error) {
    console.log(error);
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
        'developer-key': developerKey,
        'secret-key': secretKey,
        'secret-key-timestamp': secretKeyTimestamp,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new BadRequestError('post api failed', response);
    }
    console.log(response);
    return response.json();
  } catch (error) {
    console.log(error);
  }


  
}

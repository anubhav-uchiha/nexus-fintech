import { Injectable } from '@nestjs/common';
import { generateSecretKeyAndSecretTimeStamp } from 'apps/api-gateway/src/helpers/generateSecretKeyAndTimeStamp';
import { BadRequestError } from 'libs/errors/ApiError';

@Injectable()
export class EkoService {
  constructor() {}

  async useEkoService(url: string) {
    const accessKey = process.env.EKO_KEY;
    if (!accessKey) {
      throw new Error('eko access key is required in .env');
    }

    const { secretKey, secretKeyTimestamp } =
      generateSecretKeyAndSecretTimeStamp(accessKey);

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        developerKey: process.env.EKO_DEVELOPER_KEY!,
        'secret-key': secretKey,
        'secret-key-timestamp': secretKeyTimestamp.toString(),
      },
    });

    if (!resp.ok) {
      throw new BadRequestError(
        'Api failed to respond.',
        'get all services api failed.',
        'EKO_GET_ALL_SERVICES_API_FAILED',
      );
    }
    const services = await resp.json();
    return services.data;
  }

  async getAllEkoServices() {
    const ekoServices = this.useEkoService(
      '/ekoapi/v3/tools/catalog/service-codes',
    );
    console.log(ekoServices);
  }
}

import { RpcException } from '@nestjs/microservices';

import { isValidPan } from '../utils/pan-validator';
import { isValidAadhaar } from '../utils/aadhaar-validator';

export function validatePanNumber(documentNumber: unknown): string {
  if (typeof documentNumber !== 'string' || !documentNumber.trim()) {
    throw new RpcException({
      statusCode: 400,
      message: 'PAN number is required for PAN card',
    });
  }

  const pan = documentNumber.trim().toUpperCase();

  if (!isValidPan(pan)) {
    throw new RpcException({
      statusCode: 400,
      message: 'Invalid PAN number',
    });
  }

  return pan;
}

export function validateAadhaarNumber(documentNumber: unknown): string {
  if (typeof documentNumber !== 'string' || !documentNumber.trim()) {
    throw new RpcException({
      statusCode: 400,
      message: 'Aadhaar number is required',
    });
  }

  const aadhaar = documentNumber.trim();

  if (!isValidAadhaar(aadhaar)) {
    throw new RpcException({
      statusCode: 400,
      message: 'Invalid Aadhaar number',
    });
  }

  return aadhaar;
}

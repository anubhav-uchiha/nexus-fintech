import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../database/prisma.service';
import {
  DigiLockerSessionStatus,
  DocumentType,
} from 'apps/kyc-service/generated/kyc-prisma/enums';
import { ensureKycEditable } from '../kyc/helpers/kyc-status.helper';
import { DigiLockerCryptoService } from './digilocker-crypto.service';

@Injectable()
export class DigiLockerSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: DigiLockerCryptoService,
  ) {}

  async createAuthorizationSession(
    identityId: string,
    requestedScopes: string[] = [],
  ) {
    const kyc = await this.prisma.kyc.findUnique({
      where: {
        identityId,
      },
    });

    if (!kyc) {
      throw new RpcException({
        statusCode: 404,
        message: 'KYC not found',
      });
    }

    ensureKycEditable(kyc.status);

    const state = randomBytes(32).toString('base64url');
    const stateHash = this.hashState(state);

    const { codeVerifier, codeChallenge, codeChallengeMethod } =
      this.cryptoService.generatePkcePair();

    const encryptedCodeVerifier = this.cryptoService.encrypt(codeVerifier);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.digiLockerVerificationSession.updateMany({
        where: {
          kycId: kyc.id,
          status: DigiLockerSessionStatus.INITIATED,
        },
        data: {
          status: DigiLockerSessionStatus.CANCELLED,
          pkceVerifierEncrypted: null,
        },
      });

      return tx.digiLockerVerificationSession.create({
        data: {
          kyc: {
            connect: {
              id: kyc.id,
            },
          },
          stateHash,
          pkceVerifierEncrypted: encryptedCodeVerifier,
          status: DigiLockerSessionStatus.INITIATED,
          requestedDocumentTypes: [DocumentType.PAN_CARD, DocumentType.AADHAAR],
          requestedScopes,
          expiresAt,
        },
      });
    });

    return {
      sessionId: session.id,
      state,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    };
  }

  async consumeAuthorizationState(state: string) {
    if (!state || typeof state !== 'string') {
      throw this.invalidStateException();
    }

    const stateHash = this.hashState(state);

    const session = await this.prisma.digiLockerVerificationSession.findUnique({
      where: {
        stateHash,
      },
      include: {
        kyc: true,
      },
    });

    if (!session) {
      throw this.invalidStateException();
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.digiLockerVerificationSession.updateMany({
        where: {
          id: session.id,
          status: DigiLockerSessionStatus.INITIATED,
        },
        data: {
          status: DigiLockerSessionStatus.EXPIRED,
          pkceVerifierEncrypted: null,
        },
      });

      throw new RpcException({
        statusCode: 400,
        message: 'DigiLocker authorization session has expired',
      });
    }

    const claimed = await this.prisma.digiLockerVerificationSession.updateMany({
      where: {
        id: session.id,
        status: DigiLockerSessionStatus.INITIATED,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        status: DigiLockerSessionStatus.AUTHORIZED,
        callbackReceivedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      throw this.invalidStateException();
    }

    const authorizedSession =
      await this.prisma.digiLockerVerificationSession.findUniqueOrThrow({
        where: {
          id: session.id,
        },
        include: {
          kyc: true,
        },
      });

    if (!authorizedSession.pkceVerifierEncrypted) {
      await this.markFailed(
        authorizedSession.id,
        'PKCE verifier is unavailable',
        'PKCE_VERIFIER_MISSING',
      );

      throw new RpcException({
        statusCode: 500,
        message: 'DigiLocker authorization session is invalid',
      });
    }

    let codeVerifier: string;

    try {
      codeVerifier = this.cryptoService.decrypt(
        authorizedSession.pkceVerifierEncrypted,
      );
    } catch (error) {
      await this.markFailed(
        authorizedSession.id,
        'Unable to restore PKCE verifier',
        'PKCE_DECRYPT_FAILED',
      );

      throw error;
    }

    return {
      session: {
        id: authorizedSession.id,
        kycId: authorizedSession.kycId,
        status: authorizedSession.status,
        requestedDocumentTypes: authorizedSession.requestedDocumentTypes,
        requestedScopes: authorizedSession.requestedScopes,
        expiresAt: authorizedSession.expiresAt,
        kyc: authorizedSession.kyc,
      },
      codeVerifier,
    };
  }

  markCompleted(sessionId: string, grantedScopes: string[] = []) {
    return this.prisma.digiLockerVerificationSession.update({
      where: {
        id: sessionId,
      },
      data: {
        status: DigiLockerSessionStatus.COMPLETED,
        grantedScopes,
        consentGrantedAt: new Date(),
        completedAt: new Date(),
        pkceVerifierEncrypted: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  markFailed(sessionId: string, errorMessage: string, errorCode?: string) {
    return this.prisma.digiLockerVerificationSession.update({
      where: {
        id: sessionId,
      },
      data: {
        status: DigiLockerSessionStatus.FAILED,
        errorCode: errorCode?.slice(0, 100),
        errorMessage: errorMessage.slice(0, 500),
        pkceVerifierEncrypted: null,
      },
    });
  }

  private hashState(state: string): string {
    return createHash('sha256').update(state).digest('hex');
  }

  private invalidStateException() {
    return new RpcException({
      statusCode: 400,
      message: 'Invalid or already used DigiLocker authorization state',
    });
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { ApiTokenEntity } from '../entities/api-token.entity';
import { hashToken } from './token.utils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authenticated?: boolean;
      tokenId?: string;
    }
  }
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiTokenEntity)
    private readonly tokenRepository: Repository<ApiTokenEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const hashedToken = hashToken(token);

    const apiToken = await this.tokenRepository.findOne({
      where: { token: hashedToken, isActive: true },
    });

    if (!apiToken) {
      throw new UnauthorizedException('Invalid or inactive token');
    }

    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token has expired');
    }

    // Mark request as authenticated
    request.authenticated = true;
    request.tokenId = apiToken.id;

    // Update lastUsedAt asynchronously (non-blocking)
    this.tokenRepository
      .update(apiToken.id, { lastUsedAt: new Date() })
      .catch(() => {
        // Silently ignore update failures
      });

    return true;
  }
}

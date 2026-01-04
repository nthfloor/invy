import * as crypto from 'crypto';
import { generateUUID } from '../utils/uuid';

const TOKEN_PREFIX = 'invy_';

export function generateApiToken(): { token: string; hashedToken: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const token = `${TOKEN_PREFIX}${randomPart}`;
  const hashedToken = hashToken(token);

  return { token, hashedToken };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateTokenId(): string {
  return generateUUID();
}

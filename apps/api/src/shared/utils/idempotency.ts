import { createHash } from 'crypto';

/**
 * Parameters for generating an idempotency key
 */
export interface IdempotencyKeyParams {
  /** Primary reference identifier (e.g., invoiceId, clientId) */
  reference: string;
  /** Optional amount for financial transactions */
  amount?: number;
  /** Optional source identifier */
  source?: string;
  /** Optional destination identifier */
  destination?: string;
  /** Optional action type (e.g., 'create', 'update', 'payment') */
  action?: string;
}

/**
 * Generates a deterministic idempotency key based on the provided parameters.
 * The key is a 32-character SHA-256 hash that uniquely identifies the operation.
 *
 * @param params - The parameters to use for key generation
 * @returns A 32-character hexadecimal hash string
 *
 * @example
 * ```typescript
 * const key = generateIdempotencyKey({
 *   reference: 'invoice-123',
 *   amount: 100.50,
 *   action: 'payment',
 * });
 * ```
 */
export function generateIdempotencyKey({
  reference,
  amount,
  source,
  destination,
  action,
}: IdempotencyKeyParams): string {
  const parts = [reference];

  if (amount !== undefined) {
    // Use fixed precision to avoid floating point issues
    parts.push(amount.toFixed(2));
  }

  if (source) {
    parts.push(source);
  }

  if (destination) {
    parts.push(destination);
  }

  if (action) {
    parts.push(action);
  }

  const data = parts.join(':');
  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

/**
 * Hashes a client-provided idempotency key for secure storage.
 * This prevents exposure of the original key while allowing lookup.
 *
 * @param key - The original idempotency key from the client
 * @returns A SHA-256 hash of the key
 *
 * @example
 * ```typescript
 * const hashedKey = hashIdempotencyKey('client-provided-key-123');
 * ```
 */
export function hashIdempotencyKey({ key }: { key: string }): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validates that an idempotency key meets minimum requirements.
 *
 * @param key - The idempotency key to validate
 * @returns True if the key is valid, false otherwise
 */
export function isValidIdempotencyKey({ key }: { key: string }): boolean {
  // Key must be at least 16 characters and contain only valid characters
  if (!key || key.length < 16) {
    return false;
  }

  // Allow alphanumeric characters, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(key);
}

/**
 * Generates a unique idempotency key for a given operation.
 * Combines a prefix, timestamp, and random component.
 *
 * @param prefix - Optional prefix for the key (e.g., 'inv', 'pay')
 * @returns A unique idempotency key
 *
 * @example
 * ```typescript
 * const key = createUniqueIdempotencyKey({ prefix: 'invoice' });
 * // Returns something like: "invoice_1704067200000_a1b2c3d4"
 * ```
 */
export function createUniqueIdempotencyKey({
  prefix,
}: {
  prefix?: string;
}): string {
  const timestamp = Date.now();
  const random = createHash('sha256')
    .update(`${timestamp}${Math.random()}`)
    .digest('hex')
    .slice(0, 8);

  if (prefix) {
    return `${prefix}_${timestamp}_${random}`;
  }

  return `${timestamp}_${random}`;
}

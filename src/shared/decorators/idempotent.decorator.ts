import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for the Idempotent decorator
 */
export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Decorator that marks an endpoint as idempotent.
 * When applied, the IdempotencyInterceptor will:
 * 1. Check for an Idempotency-Key header
 * 2. Return a cached response if the key was used before
 * 3. Cache the response for future requests with the same key
 *
 * @example
 * ```typescript
 * @Post()
 * @Idempotent()
 * async create(@Body() dto: CreateInvoiceDto) {
 *   return this.invoiceService.create(dto);
 * }
 * ```
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

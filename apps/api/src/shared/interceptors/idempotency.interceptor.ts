import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import { IdempotencyService } from '../services/idempotency.service';
import { isValidIdempotencyKey } from '../utils/idempotency';

/**
 * Header name for the idempotency key
 */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Interceptor that handles idempotency for marked endpoints.
 *
 * For endpoints decorated with @Idempotent():
 * 1. Checks for Idempotency-Key header
 * 2. If key exists and was used before, returns cached response
 * 3. If key is new, executes the handler and caches the response
 * 4. If no key is provided, executes normally without caching
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Check if the endpoint is marked as idempotent
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as
      | string
      | undefined;

    // If no idempotency key provided, proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    // Validate the idempotency key format
    if (!isValidIdempotencyKey({ key: idempotencyKey })) {
      this.logger.warn(`Invalid idempotency key format: ${idempotencyKey}`);
      return next.handle();
    }

    const endpoint = `${request.method} ${request.path}`;

    // Check for existing record
    const checkResult = await this.idempotencyService.check({
      key: idempotencyKey,
    });

    if (checkResult.exists) {
      this.logger.debug(
        `Returning cached response for idempotency key on ${endpoint}`,
      );

      // Set the status code from the cached response
      response.status(checkResult.statusCode || HttpStatus.OK);

      // Return the cached response
      return of(checkResult.response);
    }

    // Execute the handler and cache the response
    return next.handle().pipe(
      tap((responseBody) => {
        // Only cache successful responses (2xx status codes)
        const statusCode = response.statusCode;
        if (statusCode >= 200 && statusCode < 300) {
          // Fire and forget - don't await the store operation
          this.idempotencyService
            .store({
              key: idempotencyKey,
              endpoint,
              response: responseBody as object,
              statusCode,
            })
            .catch((error: Error) => {
              this.logger.error(
                `Failed to store idempotency record: ${error.message}`,
              );
            });
        }
      }),
    );
  }
}

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyRecordEntity } from '../entities/idempotency-record.entity';
import { IdempotencyService } from '../services/idempotency.service';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

/**
 * Module for idempotency support.
 * Provides the IdempotencyService and IdempotencyInterceptor.
 *
 * This module is global, so the IdempotencyService can be injected anywhere.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecordEntity])],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}

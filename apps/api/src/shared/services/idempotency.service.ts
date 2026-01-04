import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IdempotencyRecordEntity } from '../entities/idempotency-record.entity';
import { hashIdempotencyKey } from '../utils/idempotency';

/**
 * Result of checking for an existing idempotency record
 */
export interface IdempotencyCheckResult {
  /** Whether a cached response exists */
  exists: boolean;
  /** The cached response if it exists */
  response?: object;
  /** The HTTP status code if a cached response exists */
  statusCode?: number;
}

/**
 * Parameters for storing an idempotency record
 */
export interface StoreIdempotencyParams {
  /** The original idempotency key from the client */
  key: string;
  /** The endpoint that was called */
  endpoint: string;
  /** The response to cache */
  response: object;
  /** The HTTP status code */
  statusCode: number;
  /** Time to live in milliseconds (default: 24 hours) */
  ttlMs?: number;
}

/**
 * Service for managing idempotency records.
 * Handles storage, retrieval, and cleanup of cached responses.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @InjectRepository(IdempotencyRecordEntity)
    private readonly idempotencyRepository: Repository<IdempotencyRecordEntity>,
  ) {}

  /**
   * Checks if an idempotency record exists for the given key.
   *
   * @param key - The idempotency key from the client
   * @returns The check result with cached response if exists
   */
  async check({ key }: { key: string }): Promise<IdempotencyCheckResult> {
    const keyHash = hashIdempotencyKey({ key });

    const record = await this.idempotencyRepository.findOne({
      where: { keyHash },
    });

    if (!record) {
      return { exists: false };
    }

    // Check if the record has expired
    if (record.expiresAt < new Date()) {
      await this.idempotencyRepository.delete({ keyHash });
      return { exists: false };
    }

    return {
      exists: true,
      response: record.response,
      statusCode: record.statusCode,
    };
  }

  /**
   * Stores an idempotency record for future requests.
   *
   * @param params - The parameters for storing the record
   */
  async store({
    key,
    endpoint,
    response,
    statusCode,
    ttlMs,
  }: StoreIdempotencyParams): Promise<void> {
    const keyHash = hashIdempotencyKey({ key });
    const expiresAt = new Date(Date.now() + (ttlMs || this.DEFAULT_TTL_MS));

    try {
      await this.idempotencyRepository.save({
        keyHash,
        endpoint,
        response,
        statusCode,
        expiresAt,
      });

      this.logger.debug(`Stored idempotency record for endpoint: ${endpoint}`);
    } catch (error) {
      // If the record already exists (race condition), ignore the error
      if ((error as { code?: string }).code === '23505') {
        this.logger.debug(
          `Idempotency record already exists for key hash: ${keyHash}`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Cleans up expired idempotency records.
   * Should be called periodically by a scheduled job.
   *
   * @returns The number of records deleted
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.idempotencyRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const deletedCount = result.affected || 0;

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired idempotency records`);
    }

    return deletedCount;
  }
}

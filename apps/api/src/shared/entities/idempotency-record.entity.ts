import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entity for storing idempotency records to prevent duplicate operations.
 * Each record represents a unique operation that should only be executed once.
 */
@Entity('idempotency_records')
export class IdempotencyRecordEntity {
  /**
   * Hashed idempotency key provided by the client.
   * The original key is hashed for security.
   */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  keyHash: string;

  /**
   * The endpoint that was called (e.g., "POST /invoices")
   */
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  /**
   * The cached response from the original operation.
   * Returned on subsequent requests with the same key.
   */
  @Column({ type: 'jsonb' })
  response: object;

  /**
   * HTTP status code of the original response.
   */
  @Column({ type: 'int' })
  statusCode: number;

  /**
   * Timestamp when the record was created.
   */
  @CreateDateColumn()
  createdOn: Date;

  /**
   * Timestamp when the record expires and can be cleaned up.
   * Default: 24 hours after creation.
   */
  @Index()
  @Column({ type: 'timestamp with time zone' })
  expiresAt: Date;
}

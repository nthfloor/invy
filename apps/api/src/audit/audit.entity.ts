import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'deleted'
  | 'archived'
  | 'payment_recorded'
  | 'sent'
  | 'viewed'
  | 'converted'
  | 'voided'
  | 'refunded';

export type AuditEntityType =
  | 'invoice'
  | 'quote'
  | 'credit_note'
  | 'payment'
  | 'client'
  | 'product'
  | 'tax'
  | 'company'
  | 'webhook';

export interface AuditChanges {
  [field: string]: {
    old: unknown;
    new: unknown;
  };
}

export interface AuditMetadata {
  blnkTransactionId?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  previousStatus?: string;
  newStatus?: string;
  convertedToId?: string;
  convertedFromId?: string;
  reason?: string;
  [key: string]: unknown;
}

@Entity('audit_events')
export class AuditEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  entityType!: AuditEntityType;

  @Column({ type: 'uuid' })
  @Index()
  entityId!: string;

  @Column({ type: 'varchar', length: 50 })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 50, nullable: true })
  previousState?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  newState?: string;

  @Column('jsonb', { nullable: true })
  changes?: AuditChanges;

  @Column('jsonb', { nullable: true })
  metadata?: AuditMetadata;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actor?: string; // API token name or system identifier

  @Column({ type: 'uuid', nullable: true })
  @Index()
  correlationId?: string; // Request tracing

  @CreateDateColumn()
  @Index()
  createdAt!: Date;
}

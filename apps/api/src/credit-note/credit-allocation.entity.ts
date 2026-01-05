import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CreditNoteEntity } from './credit-note.entity';

export type AllocationTargetType = 'invoice' | 'quote';
export type AllocationStatus = 'pending' | 'applied' | 'released';

/**
 * Tracks credit allocations to draft documents before Blnk persistence.
 *
 * Workflow:
 * 1. Allocate credit to draft invoice or quote (status: pending)
 * 2. When invoice is finalized/sent, allocation becomes 'applied' and net amount goes to Blnk
 * 3. If quote is rejected or draft is cancelled, allocation is 'released' back to credit note
 *
 * A single credit note can be split across multiple invoices/quotes.
 */
@Entity('credit_allocations')
export class CreditAllocationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @Column({ type: 'uuid' })
  @Index()
  creditNoteId!: string;

  @ManyToOne(() => CreditNoteEntity)
  @JoinColumn({ name: 'creditNoteId' })
  creditNote?: CreditNoteEntity;

  @Column({ type: 'varchar', length: 20 })
  targetType!: AllocationTargetType;

  @Column({ type: 'uuid' })
  @Index()
  targetId!: string; // Invoice or Quote ID

  @Column({ type: 'varchar', length: 50, nullable: true })
  targetStatus?: string; // Status of target at time of allocation (for audit)

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  @Index()
  status!: AllocationStatus;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt?: Date; // When finalized to Blnk

  @Column({ type: 'timestamp', nullable: true })
  releasedAt?: Date; // If quote rejected or invoice cancelled

  @Column({ type: 'text', nullable: true })
  releaseReason?: string; // Reason for release (e.g., "Quote rejected", "Invoice cancelled")

  @CreateDateColumn()
  createdOn!: Date;

  @UpdateDateColumn()
  updatedOn!: Date;
}

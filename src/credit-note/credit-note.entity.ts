import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CompanyEntity } from '../company/company.entity';
import { ClientEntity } from '../client/client.entity';
import { InvoiceEntity } from '../invoice/invoice.entity';

export type CreditNoteStatus = 'draft' | 'issued' | 'applied' | 'voided';

// Valid status transitions
export const VALID_CREDIT_NOTE_TRANSITIONS: Record<
  CreditNoteStatus,
  CreditNoteStatus[]
> = {
  draft: ['issued', 'voided'],
  issued: ['applied', 'voided'],
  applied: [], // Terminal state
  voided: [], // Terminal state
};

@Entity('credit_notes')
export class CreditNoteEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'companyId' })
  company?: CompanyEntity;

  @Column({ type: 'uuid' })
  @Index()
  clientId!: string;

  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: 'clientId' })
  client?: ClientEntity;

  @Column({ type: 'uuid' })
  @Index()
  invoiceId!: string; // The invoice this credit note is against

  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity;

  @Column({ type: 'varchar', length: 50 })
  @Index({ unique: true })
  creditNoteNumber!: string; // e.g., "CN-0001"

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  @Index()
  status!: CreditNoteStatus;

  @Column({ type: 'date' })
  issueDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountApplied!: number; // Amount applied to invoices

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance!: number; // Remaining credit (total - amountApplied)

  @Column({ type: 'text' })
  reason!: string; // Reason for credit note

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  voidReason?: string;

  @OneToMany(() => CreditNoteItemEntity, (item) => item.creditNote, {
    cascade: true,
  })
  items?: CreditNoteItemEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('credit_note_items')
export class CreditNoteItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  creditNoteId!: string;

  @ManyToOne(() => CreditNoteEntity, (cn) => cn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creditNoteId' })
  creditNote?: CreditNoteEntity;

  @Column({ type: 'uuid', nullable: true })
  invoiceItemId?: string; // Optional link to original invoice item

  @Column({ type: 'uuid', nullable: true })
  productId?: string; // Optional link to product

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lineTotal!: number; // (quantity * unitPrice)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  lineTax!: number; // lineTotal * (taxRate / 100)

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

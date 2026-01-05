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

export type DocumentType = 'quote' | 'estimate';

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

// Valid status transitions
export const VALID_QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'rejected'],
  sent: ['viewed', 'accepted', 'rejected', 'expired'],
  viewed: ['accepted', 'rejected', 'expired'],
  accepted: ['converted'], // Can only convert after acceptance
  rejected: [], // Terminal state
  expired: [], // Terminal state
  converted: [], // Terminal state
};

@Entity('quotes')
export class QuoteEntity {
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

  @Column({ type: 'varchar', length: 50 })
  @Index({ unique: true })
  quoteNumber!: string; // e.g., "QUO-0001" or "EST-0001"

  @Column({ type: 'varchar', length: 20 })
  @Index()
  documentType!: DocumentType; // 'quote' | 'estimate'

  @Column({ type: 'boolean', default: true })
  isFixedPrice!: boolean; // true for quotes, false for estimates

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  @Index()
  status!: QuoteStatus;

  @Column({ type: 'date' })
  issueDate!: Date;

  @Column({ type: 'date' })
  expiryDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'uuid', nullable: true })
  convertedToInvoiceId?: string; // If converted to invoice

  @Column({ type: 'text', nullable: true })
  rejectReason?: string;

  @OneToMany(() => QuoteItemEntity, (item) => item.quote, { cascade: true })
  items?: QuoteItemEntity[];

  @CreateDateColumn()
  createdOn!: Date;

  @UpdateDateColumn()
  updatedOn!: Date;
}

@Entity('quote_items')
export class QuoteItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  quoteId!: string;

  @ManyToOne(() => QuoteEntity, (quote) => quote.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quoteId' })
  quote?: QuoteEntity;

  @Column({ type: 'uuid', nullable: true })
  productId?: string; // Optional link to product

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate!: number; // Snapshot of tax rate at time of creation

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lineTotal!: number; // (quantity * unitPrice)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  lineTax!: number; // lineTotal * (taxRate / 100)

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdOn!: Date;
}

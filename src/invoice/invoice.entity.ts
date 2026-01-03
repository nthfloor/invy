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

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

// Valid status transitions
export const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> =
  {
    draft: ['sent', 'cancelled'],
    sent: ['viewed', 'partial', 'paid', 'cancelled'],
    viewed: ['partial', 'paid', 'cancelled'],
    partial: ['paid', 'cancelled'],
    paid: [], // Terminal state
    overdue: ['partial', 'paid', 'cancelled'],
    cancelled: [], // Terminal state
  };

@Entity('invoices')
export class InvoiceEntity {
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
  invoiceNumber!: string; // e.g., "INV-0001"

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  @Index()
  status!: InvoiceStatus;

  @Column({ type: 'date' })
  issueDate!: Date;

  @Column({ type: 'date' })
  dueDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxTotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance!: number; // total - amountPaid

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string;

  @Column({ type: 'uuid', nullable: true })
  convertedFromQuoteId?: string; // If created from quote

  @Column({ type: 'text', nullable: true })
  cancelReason?: string;

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice, { cascade: true })
  items?: InvoiceItemEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('invoice_items')
export class InvoiceItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity;

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
  createdAt!: Date;
}

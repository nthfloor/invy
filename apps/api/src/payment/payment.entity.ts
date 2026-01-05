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

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'cheque'
  | 'credit_note'
  | 'other';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

@Entity('payments')
export class PaymentEntity {
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
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity;

  @Column({ type: 'varchar', length: 50 })
  @Index({ unique: true })
  paymentNumber!: string; // e.g., "PAY-0001"

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 30 })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  @Index()
  status!: PaymentStatus;

  @Column({ type: 'date' })
  paymentDate!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string; // External reference (bank ref, transaction ID, etc.)

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', nullable: true })
  creditNoteId?: string; // If payment came from a credit note

  // Line item allocations (optional - for detailed payment tracking)
  @OneToMany(() => PaymentAllocationEntity, (alloc) => alloc.payment, {
    cascade: true,
  })
  allocations?: PaymentAllocationEntity[];

  @CreateDateColumn()
  createdOn!: Date;

  @UpdateDateColumn()
  updatedOn!: Date;
}

// Optional: Track which line items a payment applies to
@Entity('payment_allocations')
export class PaymentAllocationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  paymentId!: string;

  @ManyToOne(() => PaymentEntity, (payment) => payment.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment?: PaymentEntity;

  @Column({ type: 'uuid' })
  @Index()
  invoiceItemId!: string; // Which line item this allocation applies to

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number; // Amount allocated to this line item

  @CreateDateColumn()
  createdOn!: Date;
}

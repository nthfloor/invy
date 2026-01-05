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
import { CompanyEntity } from '../company/company.entity';
import { TaxEntity } from '../tax/tax.entity';

@Entity('products')
export class ProductEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'companyId' })
  company?: CompanyEntity;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'uuid', nullable: true })
  taxId?: string; // Default tax for this product

  @ManyToOne(() => TaxEntity, { nullable: true })
  @JoinColumn({ name: 'taxId' })
  tax?: TaxEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  sku?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxRate?: number; // Default tax rate percentage (e.g., 15 for 15%)

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @CreateDateColumn()
  createdOn!: Date;

  @UpdateDateColumn()
  updatedOn!: Date;
}

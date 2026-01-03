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

@Entity('taxes')
export class TaxEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'companyId' })
  company?: CompanyEntity;

  @Column({ type: 'varchar', length: 100 })
  name!: string; // e.g., "VAT 15%", "GST"

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rate!: number; // e.g., 15.00 for 15%

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean; // One default per company

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

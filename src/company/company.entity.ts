import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface CompanyAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CompanySettings {
  invoicePrefix?: string;
  quotePrefix?: string;
  estimatePrefix?: string;
  paymentTermsDays?: number;
  quoteValidityDays?: number;
}

export interface CompanyBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

@Entity('companies')
export class CompanyEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index({ unique: true })
  taxId?: string; // VAT/GST number

  @Column({ type: 'varchar', length: 3, default: 'ZAR' })
  currency!: string;

  @Column('jsonb', { nullable: true })
  address?: CompanyAddress;

  @Column('jsonb', { nullable: true, default: {} })
  settings?: CompanySettings;

  @Column('jsonb', { nullable: true })
  branding?: CompanyBranding;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

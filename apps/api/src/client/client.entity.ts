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

export interface ClientAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

@Entity('clients')
@Index(['companyId', 'email'], { unique: true })
export class ClientEntity {
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

  @Column({ type: 'varchar', length: 255 })
  @Index()
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column('jsonb', { nullable: true })
  address?: ClientAddress;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  externalId?: string; // For sync from external client registry

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  // Audit fields - populated from Cognito JWT 'sub' claim when auth is integrated
  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

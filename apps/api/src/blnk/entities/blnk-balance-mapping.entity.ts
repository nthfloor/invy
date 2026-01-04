import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type BalanceType = 'revenue' | 'cash' | 'accounts_receivable';

@Entity('blnk_balance_mappings')
@Index(['clientId', 'balanceType'], {
  unique: true,
  where: '"clientId" IS NOT NULL',
})
@Index(['balanceType'], { where: '"clientId" IS NULL' }) // For system balances
export class BlnkBalanceMappingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  clientId?: string | null; // null for system balances (revenue, cash)

  @Column({ type: 'uuid', nullable: true })
  @Index()
  companyId?: string | null; // For multi-company support

  @Column({ type: 'varchar', length: 100 })
  blnkBalanceId!: string; // The actual Blnk balance ID

  @Column({ type: 'varchar', length: 30 })
  balanceType!: BalanceType;

  @Column({ type: 'varchar', length: 100 })
  ledgerId!: string; // The Blnk ledger this balance belongs to

  @Column({ type: 'varchar', length: 10, default: 'ZAR' })
  currency!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

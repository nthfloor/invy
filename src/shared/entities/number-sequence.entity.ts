import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SequenceType =
  | 'invoice'
  | 'quote'
  | 'estimate'
  | 'credit_note'
  | 'payment';

@Entity('number_sequences')
@Index(['companyId', 'sequenceType'], { unique: true })
export class NumberSequenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @Column({ type: 'varchar', length: 50 })
  sequenceType!: SequenceType;

  @Column({ type: 'integer', default: 0 })
  lastNumber!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}

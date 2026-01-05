import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type WorkflowType = 'invoice' | 'quote' | 'credit_note' | 'payment';

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'compensated';

@Entity('workflow_states')
@Index(['entityType', 'entityId'])
@Index(['status'])
export class WorkflowStateEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  workflowType!: WorkflowType;

  @Column({ type: 'varchar', length: 50 })
  entityType!: string;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  currentState!: string;

  @Column({ type: 'jsonb', default: {} })
  context!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'running',
  })
  status!: WorkflowStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdOn!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedOn!: Date;
}

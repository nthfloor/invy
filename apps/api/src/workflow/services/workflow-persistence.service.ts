import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowStateEntity,
  WorkflowType,
  WorkflowStatus,
} from '../entities/workflow-state.entity';

export interface CreateWorkflowStateParams {
  workflowType: WorkflowType;
  entityType: string;
  entityId: string;
  companyId: string;
  correlationId?: string;
  initialState: string;
  context?: Record<string, unknown>;
}

export interface UpdateWorkflowStateParams {
  id: string;
  currentState: string;
  context?: Record<string, unknown>;
  status?: WorkflowStatus;
  error?: string;
}

@Injectable()
export class WorkflowPersistenceService {
  private readonly logger = new Logger(WorkflowPersistenceService.name);

  constructor(
    @InjectRepository(WorkflowStateEntity)
    private readonly workflowStateRepository: Repository<WorkflowStateEntity>,
  ) {}

  async create(
    params: CreateWorkflowStateParams,
  ): Promise<WorkflowStateEntity> {
    const workflowState = this.workflowStateRepository.create({
      id: uuidv4(),
      workflowType: params.workflowType,
      entityType: params.entityType,
      entityId: params.entityId,
      companyId: params.companyId,
      correlationId: params.correlationId ?? null,
      currentState: params.initialState,
      context: params.context ?? {},
      status: 'running',
    });

    const saved = await this.workflowStateRepository.save(workflowState);
    this.logger.debug(
      `Created workflow state ${saved.id} for ${params.entityType}:${params.entityId} in state ${params.initialState}`,
    );
    return saved;
  }

  async update(
    params: UpdateWorkflowStateParams,
  ): Promise<WorkflowStateEntity> {
    const workflowState = await this.workflowStateRepository.findOneOrFail({
      where: { id: params.id },
    });

    workflowState.currentState = params.currentState;

    if (params.context) {
      workflowState.context = { ...workflowState.context, ...params.context };
    }

    if (params.status) {
      workflowState.status = params.status;
      if (
        params.status === 'completed' ||
        params.status === 'failed' ||
        params.status === 'compensated'
      ) {
        workflowState.completedAt = new Date();
      }
    }

    if (params.error) {
      workflowState.error = params.error;
    }

    const saved = await this.workflowStateRepository.save(workflowState);
    this.logger.debug(
      `Updated workflow state ${saved.id} to state ${params.currentState}, status: ${saved.status}`,
    );
    return saved;
  }

  async findById(id: string): Promise<WorkflowStateEntity | null> {
    return this.workflowStateRepository.findOne({ where: { id } });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<WorkflowStateEntity | null> {
    return this.workflowStateRepository.findOne({
      where: { entityType, entityId },
      order: { createdOn: 'DESC' },
    });
  }

  async findRunningByEntity(
    entityType: string,
    entityId: string,
  ): Promise<WorkflowStateEntity | null> {
    return this.workflowStateRepository.findOne({
      where: { entityType, entityId, status: 'running' },
    });
  }

  async markCompleted(id: string): Promise<void> {
    await this.update({
      id,
      currentState: 'completed',
      status: 'completed',
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.update({
      id,
      currentState: 'failed',
      status: 'failed',
      error,
    });
  }

  async markCompensated(id: string): Promise<void> {
    await this.update({
      id,
      currentState: 'compensated',
      status: 'compensated',
    });
  }

  async getRecoverable(): Promise<WorkflowStateEntity[]> {
    return this.workflowStateRepository.find({
      where: { status: 'running' },
      order: { createdOn: 'ASC' },
    });
  }

  async getStats(): Promise<Record<WorkflowStatus, number>> {
    const results = await this.workflowStateRepository
      .createQueryBuilder('ws')
      .select('ws.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ws.status')
      .getRawMany<{ status: WorkflowStatus; count: string }>();

    const stats: Record<WorkflowStatus, number> = {
      running: 0,
      completed: 0,
      failed: 0,
      compensated: 0,
    };

    for (const result of results) {
      stats[result.status] = parseInt(result.count, 10);
    }

    return stats;
  }
}

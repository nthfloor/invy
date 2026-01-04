import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  AuditEventEntity,
  AuditAction,
  AuditEntityType,
  AuditChanges,
  AuditMetadata,
} from './audit.entity';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

export interface LogEventParams {
  companyId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  previousState?: string;
  newState?: string;
  changes?: AuditChanges;
  metadata?: AuditMetadata;
  actor?: string;
  correlationId?: string;
}

export interface GetEntityHistoryParams {
  companyId: string;
  entityType: AuditEntityType;
  entityId: string;
}

export interface GetActivityFeedParams {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: AuditEntityType;
  page?: number;
  perPage?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditRepository: Repository<AuditEventEntity>,
  ) {}

  /**
   * Log an audit event. This is fire-and-forget - errors are logged but not thrown
   * to avoid disrupting the main business flow.
   */
  async logEvent(params: LogEventParams): Promise<void> {
    try {
      const event = this.auditRepository.create({
        id: generateUUID(),
        companyId: params.companyId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        previousState: params.previousState,
        newState: params.newState,
        changes: params.changes,
        metadata: params.metadata,
        actor: params.actor,
        correlationId: params.correlationId,
      });

      await this.auditRepository.save(event);

      this.logger.debug(
        `Audit: ${params.entityType}/${params.entityId} - ${params.action}`,
      );
    } catch (error) {
      // Log but don't throw - audit logging should never break the main flow
      this.logger.error(
        `Failed to log audit event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Get the complete history of changes for a specific entity
   */
  async getEntityHistory(
    params: GetEntityHistoryParams,
  ): Promise<AuditEventEntity[]> {
    return this.auditRepository.find({
      where: {
        companyId: params.companyId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get paginated activity feed for a company with optional filters
   */
  async getActivityFeed(
    params: GetActivityFeedParams,
  ): Promise<PaginatedResult<AuditEventEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(params.page, params.perPage);

    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.companyId = :companyId', { companyId: params.companyId });

    // Filter by date range
    if (params.startDate && params.endDate) {
      queryBuilder.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    } else if (params.startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', {
        startDate: params.startDate,
      });
    } else if (params.endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', {
        endDate: params.endDate,
      });
    }

    // Filter by entity type
    if (params.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', {
        entityType: params.entityType,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('audit.createdAt', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  /**
   * Utility to detect changes between two objects
   */
  static detectChanges(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    fields: string[],
  ): AuditChanges | undefined {
    const changes: AuditChanges = {};

    for (const field of fields) {
      const oldValue = oldObj[field];
      const newValue = newObj[field];

      // Only record if values are different
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[field] = { old: oldValue, new: newValue };
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }
}

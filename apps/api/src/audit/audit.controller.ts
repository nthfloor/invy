import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditEntityType } from './audit.entity';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('entities/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit history for a specific entity' })
  @ApiParam({
    name: 'entityType',
    enum: [
      'invoice',
      'quote',
      'credit_note',
      'payment',
      'client',
      'product',
      'tax',
      'company',
      'webhook',
    ],
  })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Audit history for the entity',
  })
  getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const validEntityTypes: AuditEntityType[] = [
      'invoice',
      'quote',
      'credit_note',
      'payment',
      'client',
      'product',
      'tax',
      'company',
      'webhook',
    ];

    if (!validEntityTypes.includes(entityType as AuditEntityType)) {
      throw new BadRequestException(
        `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
      );
    }

    return this.auditService.getEntityHistory({
      companyId,
      entityType: entityType as AuditEntityType,
      entityId,
    });
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity feed for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({
    name: 'entityType',
    required: false,
    enum: [
      'invoice',
      'quote',
      'credit_note',
      'payment',
      'client',
      'product',
      'tax',
      'company',
      'webhook',
    ],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated activity feed',
  })
  getActivityFeed(
    @Query('companyId') companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const validEntityTypes: AuditEntityType[] = [
      'invoice',
      'quote',
      'credit_note',
      'payment',
      'client',
      'product',
      'tax',
      'company',
      'webhook',
    ];

    if (entityType && !validEntityTypes.includes(entityType as AuditEntityType)) {
      throw new BadRequestException(
        `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`,
      );
    }

    return this.auditService.getActivityFeed({
      companyId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      entityType: entityType as AuditEntityType | undefined,
      page,
      perPage,
    });
  }
}

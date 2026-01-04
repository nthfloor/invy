import {
  Controller,
  Get,
  Query,
  Param,
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
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import {
  CompanyStatsDto,
  InvoiceStatsDto,
  QuoteStatsDto,
  ClientStatsDto,
} from './dto';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';

@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('company')
  @ApiOperation({ summary: 'Get overall company statistics' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Company statistics',
    type: CompanyStatsDto,
  })
  async getCompanyStats(
    @Query('companyId') companyId: string,
  ): Promise<CompanyStatsDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statsService.getCompanyStats(companyId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoice statistics' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Invoice statistics',
    type: InvoiceStatsDto,
  })
  async getInvoiceStats(
    @Query('companyId') companyId: string,
  ): Promise<InvoiceStatsDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statsService.getInvoiceStats(companyId);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'Get quote statistics' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote statistics',
    type: QuoteStatsDto,
  })
  async getQuoteStats(
    @Query('companyId') companyId: string,
  ): Promise<QuoteStatsDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statsService.getQuoteStats(companyId);
  }

  @Get('clients/:clientId')
  @ApiOperation({ summary: 'Get statistics for a specific client' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Client statistics',
    type: ClientStatsDto,
  })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientStats(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('companyId') companyId: string,
  ): Promise<ClientStatsDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statsService.getClientStats({ clientId, companyId });
  }

  @Get('top-clients')
  @ApiOperation({ summary: 'Get top clients by revenue' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of clients to return (default 10)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['totalInvoiced', 'totalPaid', 'outstandingBalance'],
    description: 'Field to order by (default totalInvoiced)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top clients by revenue',
    type: [ClientStatsDto],
  })
  async getTopClients(
    @Query('companyId') companyId: string,
    @Query('limit') limit?: number,
    @Query('orderBy')
    orderBy?: 'totalInvoiced' | 'totalPaid' | 'outstandingBalance',
  ): Promise<ClientStatsDto[]> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statsService.getTopClients({
      companyId,
      limit: limit ? Number(limit) : undefined,
      orderBy,
    });
  }
}

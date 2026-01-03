import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { QuoteService } from './quote.service';
import { QuoteEntity } from './quote.entity';
import type { QuoteStatus, DocumentType } from './quote.entity';
import {
  CreateQuoteDto,
  CreateEstimateDto,
  UpdateQuoteDto,
  RejectQuoteDto,
  ConvertToInvoiceDto,
  CreateQuoteItemDto,
} from './dto';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { PaginatedResult } from '../shared/utils/pagination';
import { InvoiceEntity } from '../invoice/invoice.entity';

@ApiTags('Quotes')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quote (fixed price)' })
  @ApiResponse({
    status: 201,
    description: 'Quote created successfully',
  })
  async createQuote(@Body() dto: CreateQuoteDto): Promise<QuoteEntity> {
    return this.quoteService.createQuote(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List quotes and estimates' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'draft',
      'sent',
      'viewed',
      'accepted',
      'rejected',
      'expired',
      'converted',
    ],
  })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({
    name: 'documentType',
    required: false,
    enum: ['quote', 'estimate'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of quotes/estimates',
  })
  async findAll(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('status') status?: QuoteStatus,
    @Query('clientId') clientId?: string,
    @Query('documentType') documentType?: DocumentType,
  ): Promise<PaginatedResult<QuoteEntity>> {
    return this.quoteService.findAll(
      companyId,
      page,
      perPage,
      status,
      clientId,
      documentType,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote/estimate by ID' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate details',
  })
  @ApiResponse({ status: 404, description: 'Quote/estimate not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<QuoteEntity> {
    return this.quoteService.findById(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quote/estimate header' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft quotes/estimates can be edited',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateQuoteDto,
  ): Promise<QuoteEntity> {
    return this.quoteService.update(id, companyId, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark quote/estimate as sent' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate marked as sent',
  })
  async markAsSent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<QuoteEntity> {
    return this.quoteService.markAsSent(id, companyId);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark quote/estimate as viewed' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate marked as viewed',
  })
  async markAsViewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<QuoteEntity> {
    return this.quoteService.markAsViewed(id, companyId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept quote/estimate' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate accepted',
  })
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<QuoteEntity> {
    return this.quoteService.accept(id, companyId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject quote/estimate' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Quote/estimate rejected',
  })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: RejectQuoteDto,
  ): Promise<QuoteEntity> {
    return this.quoteService.reject(id, companyId, dto);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Convert accepted quote/estimate to invoice',
    description:
      'For quotes (isFixedPrice=true), creates an invoice with exact amounts. For estimates (isFixedPrice=false), allows adjustments to amounts.',
  })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 201,
    description: 'Invoice created from quote/estimate',
  })
  @ApiResponse({
    status: 400,
    description: 'Only accepted quotes/estimates can be converted',
  })
  async convertToInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ConvertToInvoiceDto,
  ): Promise<InvoiceEntity> {
    return this.quoteService.convertToInvoice(id, companyId, dto);
  }

  // Item management
  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to quote/estimate' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 201,
    description: 'Item added successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Can only add items to draft quotes/estimates',
  })
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateQuoteItemDto,
  ): Promise<QuoteEntity> {
    return this.quoteService.addItem(id, companyId, dto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Update quote/estimate item' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Item updated successfully',
  })
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: Partial<CreateQuoteItemDto>,
  ): Promise<QuoteEntity> {
    return this.quoteService.updateItem(id, itemId, companyId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from quote/estimate' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Item removed successfully',
  })
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<QuoteEntity> {
    return this.quoteService.removeItem(id, itemId, companyId);
  }
}

// Separate controller for estimates (alias endpoint)
@ApiTags('Estimates')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('estimates')
export class EstimateController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new estimate (variable price)' })
  @ApiResponse({
    status: 201,
    description: 'Estimate created successfully',
  })
  async createEstimate(@Body() dto: CreateEstimateDto): Promise<QuoteEntity> {
    return this.quoteService.createEstimate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List estimates only' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'draft',
      'sent',
      'viewed',
      'accepted',
      'rejected',
      'expired',
      'converted',
    ],
  })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of estimates',
  })
  async findAll(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('status') status?: QuoteStatus,
    @Query('clientId') clientId?: string,
  ): Promise<PaginatedResult<QuoteEntity>> {
    return this.quoteService.findAll(
      companyId,
      page,
      perPage,
      status,
      clientId,
      'estimate',
    );
  }
}

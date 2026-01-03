import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceItemDto,
  RecordPaymentDto,
} from './dto';
import { InvoiceStatus } from './invoice.entity';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice with items' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all invoices for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'] })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  findAll(
    @Query('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('status') status?: InvoiceStatus,
    @Query('clientId') clientId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.findAll(companyId, page, perPage, status, clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID with items' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.findById(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update invoice header (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 400, description: 'Can only update draft invoices' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.update(id, companyId, dto);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Mark invoice as sent' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Invoice marked as sent' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  markAsSent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.markAsSent(id, companyId);
  }

  @Post(':id/viewed')
  @ApiOperation({ summary: 'Mark invoice as viewed' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  markAsViewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.markAsViewed(id, companyId);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: 'Record a payment on the invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Payment recorded' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }
    return this.invoiceService.recordPayment(id, companyId, dto.amount);
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalculate invoice totals' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  recalculate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.recalculateTotals(id, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Invoice cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel paid invoice' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.cancel(id, companyId, dto);
  }

  // Item management
  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to invoice (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: CreateInvoiceItemDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.addItem(id, companyId, dto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Update invoice item (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId') companyId: string,
    @Body() dto: Partial<CreateInvoiceItemDto>,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.updateItem(id, itemId, companyId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from invoice (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.removeItem(id, itemId, companyId);
  }
}

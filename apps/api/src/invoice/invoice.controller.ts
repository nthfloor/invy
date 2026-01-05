import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
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
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceItemDto,
  RecordPaymentDto,
} from './dto';
import type { InvoiceStatus } from './invoice.entity';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { PdfService } from '../shared/pdf/pdf.service';
import { CompanyService } from '../company/company.service';
import { Idempotent } from '../shared/decorators/idempotent.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService,
    private readonly companyService: CompanyService,
  ) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a new invoice with items' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create({ dto });
  }

  @Get()
  @ApiOperation({ summary: 'List all invoices for a company' })
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
      'partial',
      'paid',
      'overdue',
      'cancelled',
    ],
  })
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
    return this.invoiceService.findAll({
      companyId,
      page,
      perPage,
      status,
      clientId,
    });
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
    return this.invoiceService.findById({ id, companyId });
  }

  @Put(':id')
  @Idempotent()
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
    return this.invoiceService.update({ id, companyId, dto });
  }

  @Post(':id/send')
  @Idempotent()
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
    return this.invoiceService.markAsSent({ id, companyId });
  }

  @Post(':id/viewed')
  @Idempotent()
  @ApiOperation({ summary: 'Mark invoice as viewed' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  markAsViewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.invoiceService.markAsViewed({ id, companyId });
  }

  @Post(':id/payment')
  @Idempotent()
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
    return this.invoiceService.recordPayment({
      id,
      companyId,
      amount: dto.amount,
    });
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
    return this.invoiceService.recalculateTotals({ id, companyId });
  }

  @Delete(':id')
  @Idempotent()
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
    return this.invoiceService.cancel({ id, companyId, dto });
  }

  // Item management
  @Post(':id/items')
  @Idempotent()
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
    return this.invoiceService.addItem({ invoiceId: id, companyId, dto });
  }

  @Put(':id/items/:itemId')
  @Idempotent()
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
    return this.invoiceService.updateItem({
      invoiceId: id,
      itemId,
      companyId,
      dto,
    });
  }

  @Delete(':id/items/:itemId')
  @Idempotent()
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
    return this.invoiceService.removeItem({ invoiceId: id, itemId, companyId });
  }

  // PDF Generation
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate PDF for invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'download',
    required: false,
    type: Boolean,
    description: 'Set to true to download as attachment',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const invoice = await this.invoiceService.findById({ id, companyId });
    const company = await this.companyService.findById({ id: companyId });

    const pdfBuffer = await this.pdfService.generateInvoicePdf(
      invoice,
      company,
    );

    const filename = `${invoice.invoiceNumber}.pdf`;
    const disposition = download === 'true' ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

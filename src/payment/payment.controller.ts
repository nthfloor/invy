import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
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
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto';
import type { PaymentStatus } from './payment.entity';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({
    summary: 'Record a payment against an invoice',
    description:
      'Records a payment and optionally allocates it to specific line items',
  })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment or exceeds balance',
  })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'completed', 'failed', 'refunded'],
  })
  findAll(
    @Query('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('invoiceId') invoiceId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.paymentService.findAll({
      companyId,
      page,
      perPage,
      invoiceId,
      clientId,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.paymentService.findById(id, companyId);
  }

  @Get('invoice/:invoiceId')
  @ApiOperation({ summary: 'Get all payments for an invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'List of payments for invoice' })
  findByInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.paymentService.findByInvoice(invoiceId, companyId);
  }

  @Get('invoice/:invoiceId/summary')
  @ApiOperation({
    summary: 'Get payment summary for an invoice',
    description:
      'Returns invoice total, amount paid, balance, and list of payments',
  })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Payment summary for invoice' })
  getPaymentSummary(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.paymentService.getPaymentSummary(invoiceId, companyId);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'reason', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Payment refunded' })
  @ApiResponse({ status: 400, description: 'Cannot refund this payment' })
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Query('reason') reason?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.paymentService.refund({ id, companyId, reason });
  }
}

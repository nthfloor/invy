import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentEntity,
  PaymentAllocationEntity,
  PaymentStatus,
} from './payment.entity';
import { CreatePaymentDto } from './dto';
import { InvoiceService } from '../invoice/invoice.service';
import { CompanyService } from '../company/company.service';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(PaymentAllocationEntity)
    private readonly allocationRepository: Repository<PaymentAllocationEntity>,
    private readonly invoiceService: InvoiceService,
    private readonly companyService: CompanyService,
    private readonly numberSequenceService: NumberSequenceService,
  ) {}

  async create({ dto }: { dto: CreatePaymentDto }): Promise<PaymentEntity> {
    // Validate company exists
    await this.companyService.findById({ id: dto.companyId });

    // Validate invoice exists and get its details
    const invoice = await this.invoiceService.findById({
      id: dto.invoiceId,
      companyId: dto.companyId,
    });

    // Validate payment amount doesn't exceed balance
    if (dto.amount > Number(invoice.balance)) {
      throw new BadRequestException(
        `Payment amount ${dto.amount} exceeds invoice balance ${invoice.balance}`,
      );
    }

    // Validate invoice status allows payments
    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot record payment on a cancelled invoice',
      );
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    // Validate allocations if provided
    if (dto.allocations && dto.allocations.length > 0) {
      const allocationTotal = dto.allocations.reduce(
        (sum, a) => sum + a.amount,
        0,
      );
      if (Math.abs(allocationTotal - dto.amount) > 0.01) {
        throw new BadRequestException(
          `Allocation total ${allocationTotal} does not match payment amount ${dto.amount}`,
        );
      }

      // Validate all invoice item IDs exist
      const invoiceItemIds = new Set(invoice.items?.map((i) => i.id) || []);
      for (const alloc of dto.allocations) {
        if (!invoiceItemIds.has(alloc.invoiceItemId)) {
          throw new BadRequestException(
            `Invoice item ${alloc.invoiceItemId} not found on this invoice`,
          );
        }
      }
    }

    // Generate payment number
    const paymentNumber = await this.numberSequenceService.getNextNumber({
      companyId: dto.companyId,
      sequenceType: 'payment',
      prefix: 'PAY',
    });

    // Create payment
    const payment = this.paymentRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      clientId: invoice.clientId,
      invoiceId: dto.invoiceId,
      paymentNumber,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      status: 'completed',
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      reference: dto.reference,
      notes: dto.notes,
      creditNoteId: dto.creditNoteId,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Create allocations if provided
    if (dto.allocations && dto.allocations.length > 0) {
      const allocations = dto.allocations.map((alloc) =>
        this.allocationRepository.create({
          id: generateUUID(),
          paymentId: savedPayment.id,
          invoiceItemId: alloc.invoiceItemId,
          amount: alloc.amount,
        }),
      );
      await this.allocationRepository.save(allocations);
    }

    // Update invoice payment status
    await this.invoiceService.recordPayment({
      id: dto.invoiceId,
      companyId: dto.companyId,
      amount: dto.amount,
    });

    this.logger.log(
      `Created payment ${paymentNumber} for ${dto.amount} on invoice ${invoice.invoiceNumber}`,
    );

    return this.findById({ id: savedPayment.id, companyId: dto.companyId });
  }

  async findById({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findOne({
      where: { id, companyId },
      relations: ['client', 'invoice', 'allocations'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findAll({
    companyId,
    page,
    perPage,
    invoiceId,
    clientId,
    status,
  }: {
    companyId: string;
    page?: number;
    perPage?: number;
    invoiceId?: string;
    clientId?: string;
    status?: PaymentStatus;
  }): Promise<PaginatedResult<PaymentEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.client', 'client')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .where('payment.companyId = :companyId', { companyId });

    if (invoiceId) {
      queryBuilder.andWhere('payment.invoiceId = :invoiceId', { invoiceId });
    }

    if (clientId) {
      queryBuilder.andWhere('payment.clientId = :clientId', { clientId });
    }

    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('payment.paymentDate', 'DESC')
      .addOrderBy('payment.createdOn', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  async findByInvoice({
    invoiceId,
    companyId,
  }: {
    invoiceId: string;
    companyId: string;
  }): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { invoiceId, companyId },
      relations: ['allocations'],
      order: { paymentDate: 'DESC', createdOn: 'DESC' },
    });
  }

  async getPaymentSummary({
    invoiceId,
    companyId,
  }: {
    invoiceId: string;
    companyId: string;
  }): Promise<{
    invoiceTotal: number;
    totalPaid: number;
    balance: number;
    payments: PaymentEntity[];
  }> {
    const invoice = await this.invoiceService.findById({
      id: invoiceId,
      companyId,
    });
    const payments = await this.findByInvoice({ invoiceId, companyId });

    return {
      invoiceTotal: Number(invoice.total),
      totalPaid: Number(invoice.amountPaid),
      balance: Number(invoice.balance),
      payments,
    };
  }

  async refund({
    id,
    companyId,
    reason,
  }: {
    id: string;
    companyId: string;
    reason?: string;
  }): Promise<PaymentEntity> {
    const payment = await this.findById({ id, companyId });

    if (payment.status === 'refunded') {
      throw new BadRequestException('Payment is already refunded');
    }

    if (payment.status !== 'completed') {
      throw new BadRequestException(
        `Cannot refund payment with status ${payment.status}`,
      );
    }

    // Update payment status
    payment.status = 'refunded';
    if (reason) {
      payment.notes = payment.notes
        ? `${payment.notes}\n\nRefund reason: ${reason}`
        : `Refund reason: ${reason}`;
    }

    const saved = await this.paymentRepository.save(payment);

    // Reverse the payment on the invoice (negative payment)
    await this.invoiceService.recordPayment({
      id: payment.invoiceId,
      companyId,
      amount: -Number(payment.amount),
    });

    this.logger.log(`Refunded payment ${payment.paymentNumber}`);

    return saved;
  }
}

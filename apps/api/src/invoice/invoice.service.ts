import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvoiceEntity,
  InvoiceItemEntity,
  InvoiceStatus,
  VALID_INVOICE_TRANSITIONS,
} from './invoice.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceItemDto,
} from './dto';
import { CompanyService } from '../company/company.service';
import { ClientService } from '../client/client.service';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(InvoiceItemEntity)
    private readonly itemRepository: Repository<InvoiceItemEntity>,
    private readonly companyService: CompanyService,
    private readonly clientService: ClientService,
    private readonly numberSequenceService: NumberSequenceService,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<InvoiceEntity> {
    // Validate company exists and get settings
    const company = await this.companyService.findById(dto.companyId);

    // Validate client exists
    const clientExists = await this.clientService.exists({
      id: dto.clientId,
      companyId: dto.companyId,
    });
    if (!clientExists) {
      throw new BadRequestException(
        `Client with ID ${dto.clientId} not found in this company`,
      );
    }

    // Generate invoice number
    const prefix = company.settings?.invoicePrefix || 'INV';
    const invoiceNumber = await this.numberSequenceService.getNextNumber({
      companyId: dto.companyId,
      sequenceType: 'invoice',
      prefix,
    });

    // Calculate dates
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const paymentTermsDays = company.settings?.paymentTermsDays || 30;
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(issueDate.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);

    // Create invoice
    const invoice = this.invoiceRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      clientId: dto.clientId,
      invoiceNumber,
      status: 'draft',
      issueDate,
      dueDate,
      notes: dto.notes,
      terms: dto.terms,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      amountPaid: 0,
      balance: 0,
    });

    // Save invoice first to get ID
    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Create items
    const items = dto.items.map((item, index) =>
      this.createInvoiceItem({
        invoiceId: savedInvoice.id,
        dto: item,
        sortOrder: index,
      }),
    );
    await this.itemRepository.save(items);

    // Calculate totals
    return this.recalculateTotals({
      id: savedInvoice.id,
      companyId: dto.companyId,
    });
  }

  private createInvoiceItem({
    invoiceId,
    dto,
    sortOrder,
  }: {
    invoiceId: string;
    dto: CreateInvoiceItemDto;
    sortOrder: number;
  }): InvoiceItemEntity {
    const lineTotal = Number(dto.quantity) * Number(dto.unitPrice);
    const taxRate = dto.taxRate || 0;
    const lineTax = lineTotal * (taxRate / 100);

    return this.itemRepository.create({
      id: generateUUID(),
      invoiceId,
      productId: dto.productId,
      description: dto.description,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      taxRate,
      lineTotal,
      lineTax,
      sortOrder,
    });
  }

  async recalculateTotals({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id, companyId });

    const items = await this.itemRepository.find({
      where: { invoiceId: id },
    });

    let subtotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      subtotal += Number(item.lineTotal);
      taxTotal += Number(item.lineTax);
    }

    const total = subtotal + taxTotal;
    const balance = total - Number(invoice.amountPaid);

    invoice.subtotal = subtotal;
    invoice.taxTotal = taxTotal;
    invoice.total = total;
    invoice.balance = balance;

    return this.invoiceRepository.save(invoice);
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateInvoiceDto;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id, companyId });

    // Only draft invoices can be edited
    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        'Only draft invoices can be edited. Cancel this invoice and create a new one.',
      );
    }

    if (dto.dueDate !== undefined) invoice.dueDate = new Date(dto.dueDate);
    if (dto.notes !== undefined) invoice.notes = dto.notes;
    if (dto.terms !== undefined) invoice.terms = dto.terms;

    const saved = await this.invoiceRepository.save(invoice);
    this.logger.log(`Updated invoice: ${saved.id}`);

    return saved;
  }

  async markAsSent({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<InvoiceEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'sent' });
  }

  async markAsViewed({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<InvoiceEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'viewed' });
  }

  async recordPayment({
    id,
    companyId,
    amount,
  }: {
    id: string;
    companyId: string;
    amount: number;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id, companyId });

    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot record payment on cancelled invoice',
      );
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const newAmountPaid = Number(invoice.amountPaid) + amount;
    const newBalance = Number(invoice.total) - newAmountPaid;

    invoice.amountPaid = newAmountPaid;
    invoice.balance = Math.max(0, newBalance);

    // Determine new status
    if (newBalance <= 0) {
      invoice.status = 'paid';
    } else if (newAmountPaid > 0) {
      invoice.status = 'partial';
    }

    const saved = await this.invoiceRepository.save(invoice);
    this.logger.log(
      `Recorded payment of ${amount} on invoice ${id}. New status: ${saved.status}`,
    );

    return saved;
  }

  async cancel({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: CancelInvoiceDto;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id, companyId });

    if (invoice.status === 'paid') {
      throw new BadRequestException(
        'Cannot cancel a paid invoice. Create a credit note instead.',
      );
    }

    if (invoice.status === 'cancelled') {
      throw new BadRequestException('Invoice is already cancelled');
    }

    invoice.status = 'cancelled';
    invoice.cancelReason = dto.reason;

    const saved = await this.invoiceRepository.save(invoice);
    this.logger.log(`Cancelled invoice: ${id}`);

    return saved;
  }

  private async transitionStatus({
    id,
    companyId,
    newStatus,
  }: {
    id: string;
    companyId: string;
    newStatus: InvoiceStatus;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id, companyId });

    const validTransitions = VALID_INVOICE_TRANSITIONS[invoice.status];
    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${invoice.status} to ${newStatus}`,
      );
    }

    invoice.status = newStatus;
    const saved = await this.invoiceRepository.save(invoice);
    this.logger.log(`Invoice ${id} status changed to ${newStatus}`);

    return saved;
  }

  async findById({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, companyId },
      relations: ['items', 'client'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Sort items by sortOrder
    if (invoice.items) {
      invoice.items.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return invoice;
  }

  async findAll({
    companyId,
    page,
    perPage,
    status,
    clientId,
  }: {
    companyId: string;
    page?: number;
    perPage?: number;
    status?: InvoiceStatus;
    clientId?: string;
  }): Promise<PaginatedResult<InvoiceEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.companyId = :companyId', { companyId });

    if (status) {
      queryBuilder.andWhere('invoice.status = :status', { status });
    }

    if (clientId) {
      queryBuilder.andWhere('invoice.clientId = :clientId', { clientId });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('invoice.createdAt', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  // Item management
  async addItem({
    invoiceId,
    companyId,
    dto,
  }: {
    invoiceId: string;
    companyId: string;
    dto: CreateInvoiceItemDto;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id: invoiceId, companyId });

    if (invoice.status !== 'draft') {
      throw new BadRequestException('Can only add items to draft invoices');
    }

    const maxSortOrder =
      invoice.items?.reduce((max, item) => Math.max(max, item.sortOrder), -1) ??
      -1;

    const item = this.createInvoiceItem({
      invoiceId,
      dto,
      sortOrder: maxSortOrder + 1,
    });
    await this.itemRepository.save(item);

    return this.recalculateTotals({ id: invoiceId, companyId });
  }

  async updateItem({
    invoiceId,
    itemId,
    companyId,
    dto,
  }: {
    invoiceId: string;
    itemId: string;
    companyId: string;
    dto: Partial<CreateInvoiceItemDto>;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id: invoiceId, companyId });

    if (invoice.status !== 'draft') {
      throw new BadRequestException('Can only update items on draft invoices');
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, invoiceId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    if (dto.description !== undefined) item.description = dto.description;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice;
    if (dto.taxRate !== undefined) item.taxRate = dto.taxRate;
    if (dto.productId !== undefined) item.productId = dto.productId;

    // Recalculate line totals
    item.lineTotal = Number(item.quantity) * Number(item.unitPrice);
    item.lineTax = item.lineTotal * (Number(item.taxRate) / 100);

    await this.itemRepository.save(item);

    return this.recalculateTotals({ id: invoiceId, companyId });
  }

  async removeItem({
    invoiceId,
    itemId,
    companyId,
  }: {
    invoiceId: string;
    itemId: string;
    companyId: string;
  }): Promise<InvoiceEntity> {
    const invoice = await this.findById({ id: invoiceId, companyId });

    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        'Can only remove items from draft invoices',
      );
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, invoiceId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    await this.itemRepository.remove(item);

    return this.recalculateTotals({ id: invoiceId, companyId });
  }
}

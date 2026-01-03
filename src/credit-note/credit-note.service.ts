import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreditNoteEntity,
  CreditNoteItemEntity,
  CreditNoteStatus,
  VALID_CREDIT_NOTE_TRANSITIONS,
} from './credit-note.entity';
import {
  CreateCreditNoteDto,
  UpdateCreditNoteDto,
  VoidCreditNoteDto,
  ApplyCreditNoteDto,
  CreateCreditNoteItemDto,
} from './dto';
import { CompanyService } from '../company/company.service';
import { ClientService } from '../client/client.service';
import { InvoiceService } from '../invoice/invoice.service';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class CreditNoteService {
  private readonly logger = new Logger(CreditNoteService.name);

  constructor(
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepository: Repository<CreditNoteEntity>,
    @InjectRepository(CreditNoteItemEntity)
    private readonly itemRepository: Repository<CreditNoteItemEntity>,
    private readonly companyService: CompanyService,
    private readonly clientService: ClientService,
    private readonly invoiceService: InvoiceService,
    private readonly numberSequenceService: NumberSequenceService,
  ) {}

  async create(dto: CreateCreditNoteDto): Promise<CreditNoteEntity> {
    // Validate company exists
    const company = await this.companyService.findById(dto.companyId);

    // Validate client exists
    const clientExists = await this.clientService.exists(
      dto.clientId,
      dto.companyId,
    );
    if (!clientExists) {
      throw new BadRequestException(
        `Client with ID ${dto.clientId} not found in this company`,
      );
    }

    // Validate invoice exists and belongs to this client/company
    const invoice = await this.invoiceService.findById(
      dto.invoiceId,
      dto.companyId,
    );
    if (invoice.clientId !== dto.clientId) {
      throw new BadRequestException(
        'Invoice does not belong to the specified client',
      );
    }

    // Generate credit note number
    const creditNoteNumber = await this.numberSequenceService.getNextNumber({
      companyId: dto.companyId,
      sequenceType: 'credit_note',
      prefix: company.settings?.invoicePrefix
        ? `CN-${company.settings.invoicePrefix.replace('INV', '')}`
        : 'CN',
    });

    // Calculate dates
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

    // Create credit note
    const creditNote = this.creditNoteRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      clientId: dto.clientId,
      invoiceId: dto.invoiceId,
      creditNoteNumber,
      status: 'draft',
      issueDate,
      reason: dto.reason,
      notes: dto.notes,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      amountApplied: 0,
      balance: 0,
    });

    // Save credit note first to get ID
    const savedCreditNote = await this.creditNoteRepository.save(creditNote);

    // Create items
    const items = dto.items.map((item, index) =>
      this.createCreditNoteItem({
        creditNoteId: savedCreditNote.id,
        dto: item,
        sortOrder: index,
      }),
    );
    await this.itemRepository.save(items);

    // Calculate totals
    return this.recalculateTotals(savedCreditNote.id, dto.companyId);
  }

  private createCreditNoteItem({
    creditNoteId,
    dto,
    sortOrder,
  }: {
    creditNoteId: string;
    dto: CreateCreditNoteItemDto;
    sortOrder: number;
  }): CreditNoteItemEntity {
    const lineTotal = Number(dto.quantity) * Number(dto.unitPrice);
    const taxRate = dto.taxRate || 0;
    const lineTax = lineTotal * (taxRate / 100);

    return this.itemRepository.create({
      id: generateUUID(),
      creditNoteId,
      invoiceItemId: dto.invoiceItemId,
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

  async recalculateTotals(
    id: string,
    companyId: string,
  ): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(id, companyId);

    const items = await this.itemRepository.find({
      where: { creditNoteId: id },
    });

    let subtotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      subtotal += Number(item.lineTotal);
      taxTotal += Number(item.lineTax);
    }

    const total = subtotal + taxTotal;
    const balance = total - Number(creditNote.amountApplied);

    creditNote.subtotal = subtotal;
    creditNote.taxTotal = taxTotal;
    creditNote.total = total;
    creditNote.balance = balance;

    return this.creditNoteRepository.save(creditNote);
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateCreditNoteDto;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(id, companyId);

    // Only draft credit notes can be edited
    if (creditNote.status !== 'draft') {
      throw new BadRequestException(
        'Only draft credit notes can be edited. Void this credit note and create a new one.',
      );
    }

    if (dto.issueDate !== undefined)
      creditNote.issueDate = new Date(dto.issueDate);
    if (dto.reason !== undefined) creditNote.reason = dto.reason;
    if (dto.notes !== undefined) creditNote.notes = dto.notes;

    const saved = await this.creditNoteRepository.save(creditNote);
    this.logger.log(`Updated credit note: ${saved.id}`);

    return saved;
  }

  async issue(id: string, companyId: string): Promise<CreditNoteEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'issued' });
  }

  async apply({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: ApplyCreditNoteDto;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(id, companyId);

    if (creditNote.status !== 'issued') {
      throw new BadRequestException(
        'Can only apply issued credit notes. Issue the credit note first.',
      );
    }

    if (dto.amount > Number(creditNote.balance)) {
      throw new BadRequestException(
        `Cannot apply ${dto.amount}. Credit note balance is only ${creditNote.balance}`,
      );
    }

    // Apply to invoice (record as payment)
    await this.invoiceService.recordPayment({
      id: dto.invoiceId,
      companyId,
      amount: dto.amount,
    });

    // Update credit note
    const newAmountApplied = Number(creditNote.amountApplied) + dto.amount;
    const newBalance = Number(creditNote.total) - newAmountApplied;

    creditNote.amountApplied = newAmountApplied;
    creditNote.balance = Math.max(0, newBalance);

    // If fully applied, change status
    if (newBalance <= 0) {
      creditNote.status = 'applied';
    }

    const saved = await this.creditNoteRepository.save(creditNote);
    this.logger.log(
      `Applied ${dto.amount} from credit note ${id} to invoice ${dto.invoiceId}`,
    );

    return saved;
  }

  async void({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: VoidCreditNoteDto;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(id, companyId);

    if (creditNote.status === 'applied') {
      throw new BadRequestException(
        'Cannot void an applied credit note. It has already been used.',
      );
    }

    if (creditNote.status === 'voided') {
      throw new BadRequestException('Credit note is already voided');
    }

    creditNote.status = 'voided';
    creditNote.voidReason = dto.reason;

    const saved = await this.creditNoteRepository.save(creditNote);
    this.logger.log(`Voided credit note: ${id}`);

    return saved;
  }

  private async transitionStatus({
    id,
    companyId,
    newStatus,
  }: {
    id: string;
    companyId: string;
    newStatus: CreditNoteStatus;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(id, companyId);

    const validTransitions = VALID_CREDIT_NOTE_TRANSITIONS[creditNote.status];
    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${creditNote.status} to ${newStatus}`,
      );
    }

    creditNote.status = newStatus;
    const saved = await this.creditNoteRepository.save(creditNote);
    this.logger.log(`Credit note ${id} status changed to ${newStatus}`);

    return saved;
  }

  async findById(id: string, companyId: string): Promise<CreditNoteEntity> {
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id, companyId },
      relations: ['items', 'client', 'invoice'],
    });

    if (!creditNote) {
      throw new NotFoundException(`Credit note with ID ${id} not found`);
    }

    // Sort items by sortOrder
    if (creditNote.items) {
      creditNote.items.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return creditNote;
  }

  async findAll({
    companyId,
    page,
    perPage,
    status,
    clientId,
    invoiceId,
  }: {
    companyId: string;
    page?: number;
    perPage?: number;
    status?: CreditNoteStatus;
    clientId?: string;
    invoiceId?: string;
  }): Promise<PaginatedResult<CreditNoteEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.creditNoteRepository
      .createQueryBuilder('creditNote')
      .leftJoinAndSelect('creditNote.client', 'client')
      .leftJoinAndSelect('creditNote.invoice', 'invoice')
      .where('creditNote.companyId = :companyId', { companyId });

    if (status) {
      queryBuilder.andWhere('creditNote.status = :status', { status });
    }

    if (clientId) {
      queryBuilder.andWhere('creditNote.clientId = :clientId', { clientId });
    }

    if (invoiceId) {
      queryBuilder.andWhere('creditNote.invoiceId = :invoiceId', { invoiceId });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('creditNote.createdAt', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  // Item management
  async addItem({
    creditNoteId,
    companyId,
    dto,
  }: {
    creditNoteId: string;
    companyId: string;
    dto: CreateCreditNoteItemDto;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(creditNoteId, companyId);

    if (creditNote.status !== 'draft') {
      throw new BadRequestException('Can only add items to draft credit notes');
    }

    const maxSortOrder =
      creditNote.items?.reduce(
        (max, item) => Math.max(max, item.sortOrder),
        -1,
      ) ?? -1;

    const item = this.createCreditNoteItem({
      creditNoteId,
      dto,
      sortOrder: maxSortOrder + 1,
    });
    await this.itemRepository.save(item);

    return this.recalculateTotals(creditNoteId, companyId);
  }

  async updateItem({
    creditNoteId,
    itemId,
    companyId,
    dto,
  }: {
    creditNoteId: string;
    itemId: string;
    companyId: string;
    dto: Partial<CreateCreditNoteItemDto>;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(creditNoteId, companyId);

    if (creditNote.status !== 'draft') {
      throw new BadRequestException(
        'Can only update items on draft credit notes',
      );
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, creditNoteId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    if (dto.description !== undefined) item.description = dto.description;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice;
    if (dto.taxRate !== undefined) item.taxRate = dto.taxRate;
    if (dto.productId !== undefined) item.productId = dto.productId;
    if (dto.invoiceItemId !== undefined) item.invoiceItemId = dto.invoiceItemId;

    // Recalculate line totals
    item.lineTotal = Number(item.quantity) * Number(item.unitPrice);
    item.lineTax = item.lineTotal * (Number(item.taxRate) / 100);

    await this.itemRepository.save(item);

    return this.recalculateTotals(creditNoteId, companyId);
  }

  async removeItem({
    creditNoteId,
    itemId,
    companyId,
  }: {
    creditNoteId: string;
    itemId: string;
    companyId: string;
  }): Promise<CreditNoteEntity> {
    const creditNote = await this.findById(creditNoteId, companyId);

    if (creditNote.status !== 'draft') {
      throw new BadRequestException(
        'Can only remove items from draft credit notes',
      );
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, creditNoteId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    await this.itemRepository.remove(item);

    return this.recalculateTotals(creditNoteId, companyId);
  }
}

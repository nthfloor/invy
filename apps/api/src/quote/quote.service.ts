import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QuoteEntity,
  QuoteItemEntity,
  QuoteStatus,
  DocumentType,
  VALID_QUOTE_TRANSITIONS,
} from './quote.entity';
import {
  CreateQuoteDto,
  CreateQuoteItemDto,
  UpdateQuoteDto,
  RejectQuoteDto,
  ConvertToInvoiceDto,
} from './dto';
import { InvoiceEntity, InvoiceItemEntity } from '../invoice/invoice.entity';
import { CompanyService } from '../company/company.service';
import { ClientService } from '../client/client.service';
import { CreditAllocationService } from '../credit-note/credit-allocation.service';
import { NumberSequenceService } from '../shared/services/number-sequence.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    @InjectRepository(QuoteEntity)
    private readonly quoteRepository: Repository<QuoteEntity>,
    @InjectRepository(QuoteItemEntity)
    private readonly itemRepository: Repository<QuoteItemEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(InvoiceItemEntity)
    private readonly invoiceItemRepository: Repository<InvoiceItemEntity>,
    private readonly companyService: CompanyService,
    private readonly clientService: ClientService,
    private readonly creditAllocationService: CreditAllocationService,
    private readonly numberSequenceService: NumberSequenceService,
  ) {}

  async createQuote(dto: CreateQuoteDto): Promise<QuoteEntity> {
    return this.create({ dto, documentType: 'quote', isFixedPrice: true });
  }

  async createEstimate(dto: CreateQuoteDto): Promise<QuoteEntity> {
    return this.create({ dto, documentType: 'estimate', isFixedPrice: false });
  }

  private async create({
    dto,
    documentType,
    isFixedPrice,
  }: {
    dto: CreateQuoteDto;
    documentType: DocumentType;
    isFixedPrice: boolean;
  }): Promise<QuoteEntity> {
    // Validate company exists and get settings
    const company = await this.companyService.findById({ id: dto.companyId });

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

    // Generate quote/estimate number
    const prefix =
      documentType === 'quote'
        ? company.settings?.quotePrefix || 'QUO'
        : company.settings?.estimatePrefix || 'EST';

    const sequenceType = documentType === 'quote' ? 'quote' : 'estimate';
    const quoteNumber = await this.numberSequenceService.getNextNumber({
      companyId: dto.companyId,
      sequenceType,
      prefix,
    });

    // Calculate dates
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const quoteValidityDays = company.settings?.quoteValidityDays || 30;
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : new Date(issueDate.getTime() + quoteValidityDays * 24 * 60 * 60 * 1000);

    // Create quote
    const quote = this.quoteRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      clientId: dto.clientId,
      quoteNumber,
      documentType,
      isFixedPrice,
      status: 'draft',
      issueDate,
      expiryDate,
      notes: dto.notes,
      terms: dto.terms,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
    });

    // Save quote first to get ID
    const savedQuote = await this.quoteRepository.save(quote);

    // Create items
    const items = dto.items.map((item, index) =>
      this.createQuoteItem({
        quoteId: savedQuote.id,
        dto: item,
        sortOrder: index,
      }),
    );
    await this.itemRepository.save(items);

    // Calculate totals
    return this.recalculateTotals({
      id: savedQuote.id,
      companyId: dto.companyId,
    });
  }

  private createQuoteItem({
    quoteId,
    dto,
    sortOrder,
  }: {
    quoteId: string;
    dto: CreateQuoteItemDto;
    sortOrder: number;
  }): QuoteItemEntity {
    const lineTotal = Number(dto.quantity) * Number(dto.unitPrice);
    const taxRate = dto.taxRate || 0;
    const lineTax = lineTotal * (taxRate / 100);

    return this.itemRepository.create({
      id: generateUUID(),
      quoteId,
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
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id, companyId });

    const items = await this.itemRepository.find({
      where: { quoteId: id },
    });

    let subtotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      subtotal += Number(item.lineTotal);
      taxTotal += Number(item.lineTax);
    }

    const total = subtotal + taxTotal;

    quote.subtotal = subtotal;
    quote.taxTotal = taxTotal;
    quote.total = total;

    return this.quoteRepository.save(quote);
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateQuoteDto;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id, companyId });

    // Only draft quotes can be edited
    if (quote.status !== 'draft') {
      throw new BadRequestException(
        'Only draft quotes/estimates can be edited',
      );
    }

    if (dto.expiryDate !== undefined)
      quote.expiryDate = new Date(dto.expiryDate);
    if (dto.notes !== undefined) quote.notes = dto.notes;
    if (dto.terms !== undefined) quote.terms = dto.terms;

    const saved = await this.quoteRepository.save(quote);
    this.logger.log(`Updated ${quote.documentType}: ${saved.id}`);

    return saved;
  }

  async markAsSent({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<QuoteEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'sent' });
  }

  async markAsViewed({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<QuoteEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'viewed' });
  }

  async accept({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<QuoteEntity> {
    return this.transitionStatus({ id, companyId, newStatus: 'accepted' });
  }

  async reject({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: RejectQuoteDto;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id, companyId });

    const validFromStates: QuoteStatus[] = ['draft', 'sent', 'viewed'];
    if (!validFromStates.includes(quote.status)) {
      throw new BadRequestException(
        `Cannot reject a ${quote.documentType} with status: ${quote.status}`,
      );
    }

    // Release any pending credit allocations back to the credit notes
    const releasedAllocations =
      await this.creditAllocationService.releaseAllByTarget({
        companyId,
        targetType: 'quote',
        targetId: id,
        reason: dto.reason || 'Quote rejected',
      });

    if (releasedAllocations.length > 0) {
      const totalReleased = releasedAllocations.reduce(
        (sum, a) => sum + Number(a.amount),
        0,
      );
      this.logger.log(
        `Released ${totalReleased} in credit allocations for rejected ${quote.documentType} ${id}`,
      );
    }

    quote.status = 'rejected';
    quote.rejectReason = dto.reason;

    const saved = await this.quoteRepository.save(quote);
    this.logger.log(`Rejected ${quote.documentType}: ${id}`);

    return saved;
  }

  async convertToInvoice({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: ConvertToInvoiceDto;
  }): Promise<InvoiceEntity> {
    const quote = await this.findById({ id, companyId });

    if (quote.status !== 'accepted') {
      throw new BadRequestException(
        `Only accepted ${quote.documentType}s can be converted to invoices`,
      );
    }

    // For quotes (fixed price), adjustments are not allowed
    if (quote.isFixedPrice && dto.adjustedItems?.length) {
      throw new BadRequestException(
        'Cannot adjust items for fixed-price quotes. Use an estimate for variable pricing.',
      );
    }

    // Get company for invoice number generation
    const company = await this.companyService.findById({ id: companyId });
    const prefix = company.settings?.invoicePrefix || 'INV';
    const invoiceNumber = await this.numberSequenceService.getNextNumber({
      companyId,
      sequenceType: 'invoice',
      prefix,
    });

    // Calculate dates
    const issueDate = new Date();
    const paymentTermsDays = company.settings?.paymentTermsDays || 30;
    const dueDate = new Date(
      issueDate.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
    );

    // Create invoice
    const invoice = this.invoiceRepository.create({
      id: generateUUID(),
      companyId: quote.companyId,
      clientId: quote.clientId,
      invoiceNumber,
      status: quote.isFixedPrice ? 'draft' : 'draft', // Both start as draft
      issueDate,
      dueDate,
      notes: quote.notes,
      terms: quote.terms,
      convertedFromQuoteId: quote.id,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      amountPaid: 0,
      balance: 0,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Build adjustments map for estimates
    const adjustmentsMap = new Map<
      string,
      { quantity?: number; unitPrice?: number; description?: string }
    >();
    if (dto.adjustedItems) {
      for (const adj of dto.adjustedItems) {
        adjustmentsMap.set(adj.quoteItemId, adj);
      }
    }

    // Copy items from quote to invoice, applying adjustments for estimates
    const quoteItems = quote.items || [];
    const invoiceItems: InvoiceItemEntity[] = [];

    for (let i = 0; i < quoteItems.length; i++) {
      const quoteItem = quoteItems[i];
      const adjustment = adjustmentsMap.get(quoteItem.id);

      const quantity = adjustment?.quantity ?? quoteItem.quantity;
      const unitPrice = adjustment?.unitPrice ?? quoteItem.unitPrice;
      const description = adjustment?.description ?? quoteItem.description;
      const taxRate = quoteItem.taxRate;

      const lineTotal = Number(quantity) * Number(unitPrice);
      const lineTax = lineTotal * (Number(taxRate) / 100);

      invoiceItems.push(
        this.invoiceItemRepository.create({
          id: generateUUID(),
          invoiceId: savedInvoice.id,
          productId: quoteItem.productId,
          description,
          quantity,
          unitPrice,
          taxRate,
          lineTotal,
          lineTax,
          sortOrder: i,
        }),
      );
    }

    // Add additional items if provided
    if (dto.additionalItems) {
      for (let i = 0; i < dto.additionalItems.length; i++) {
        const addItem = dto.additionalItems[i];
        const taxRate = addItem.taxRate || 0;
        const lineTotal = Number(addItem.quantity) * Number(addItem.unitPrice);
        const lineTax = lineTotal * (taxRate / 100);

        invoiceItems.push(
          this.invoiceItemRepository.create({
            id: generateUUID(),
            invoiceId: savedInvoice.id,
            productId: addItem.productId,
            description: addItem.description,
            quantity: addItem.quantity,
            unitPrice: addItem.unitPrice,
            taxRate,
            lineTotal,
            lineTax,
            sortOrder: quoteItems.length + i,
          }),
        );
      }
    }

    await this.invoiceItemRepository.save(invoiceItems);

    // Recalculate invoice totals
    let subtotal = 0;
    let taxTotal = 0;
    for (const item of invoiceItems) {
      subtotal += Number(item.lineTotal);
      taxTotal += Number(item.lineTax);
    }
    const total = subtotal + taxTotal;

    savedInvoice.subtotal = subtotal;
    savedInvoice.taxTotal = taxTotal;
    savedInvoice.total = total;
    savedInvoice.balance = total;
    await this.invoiceRepository.save(savedInvoice);

    // Transfer any pending credit allocations from quote to invoice
    const transferredAllocations = await this.creditAllocationService.transfer({
      companyId,
      fromTargetType: 'quote',
      fromTargetId: id,
      toTargetType: 'invoice',
      toTargetId: savedInvoice.id,
      toTargetStatus: 'draft',
    });

    if (transferredAllocations.length > 0) {
      const totalTransferred = transferredAllocations.reduce(
        (sum, a) => sum + Number(a.amount),
        0,
      );
      this.logger.log(
        `Transferred ${totalTransferred} in credit allocations from ${quote.documentType} ${id} to invoice ${savedInvoice.id}`,
      );
    }

    // Update quote status to converted
    quote.status = 'converted';
    quote.convertedToInvoiceId = savedInvoice.id;
    await this.quoteRepository.save(quote);

    this.logger.log(
      `Converted ${quote.documentType} ${id} to invoice ${savedInvoice.id}`,
    );

    return savedInvoice;
  }

  private async transitionStatus({
    id,
    companyId,
    newStatus,
  }: {
    id: string;
    companyId: string;
    newStatus: QuoteStatus;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id, companyId });

    const validTransitions = VALID_QUOTE_TRANSITIONS[quote.status];
    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${quote.status} to ${newStatus}`,
      );
    }

    quote.status = newStatus;
    const saved = await this.quoteRepository.save(quote);
    this.logger.log(
      `${quote.documentType} ${id} status changed to ${newStatus}`,
    );

    return saved;
  }

  async findById({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<QuoteEntity> {
    const quote = await this.quoteRepository.findOne({
      where: { id, companyId },
      relations: ['items', 'client'],
    });

    if (!quote) {
      throw new NotFoundException(`Quote/Estimate with ID ${id} not found`);
    }

    // Sort items by sortOrder
    if (quote.items) {
      quote.items.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return quote;
  }

  async findAll({
    companyId,
    page,
    perPage,
    status,
    clientId,
    documentType,
  }: {
    companyId: string;
    page?: number;
    perPage?: number;
    status?: QuoteStatus;
    clientId?: string;
    documentType?: DocumentType;
  }): Promise<PaginatedResult<QuoteEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.quoteRepository
      .createQueryBuilder('quote')
      .leftJoinAndSelect('quote.client', 'client')
      .where('quote.companyId = :companyId', { companyId });

    if (status) {
      queryBuilder.andWhere('quote.status = :status', { status });
    }

    if (clientId) {
      queryBuilder.andWhere('quote.clientId = :clientId', { clientId });
    }

    if (documentType) {
      queryBuilder.andWhere('quote.documentType = :documentType', {
        documentType,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('quote.createdOn', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  // Item management
  async addItem({
    quoteId,
    companyId,
    dto,
  }: {
    quoteId: string;
    companyId: string;
    dto: CreateQuoteItemDto;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id: quoteId, companyId });

    if (quote.status !== 'draft') {
      throw new BadRequestException(
        'Can only add items to draft quotes/estimates',
      );
    }

    const maxSortOrder =
      quote.items?.reduce((max, item) => Math.max(max, item.sortOrder), -1) ??
      -1;

    const item = this.createQuoteItem({
      quoteId,
      dto,
      sortOrder: maxSortOrder + 1,
    });
    await this.itemRepository.save(item);

    return this.recalculateTotals({ id: quoteId, companyId });
  }

  async updateItem({
    quoteId,
    itemId,
    companyId,
    dto,
  }: {
    quoteId: string;
    itemId: string;
    companyId: string;
    dto: Partial<CreateQuoteItemDto>;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id: quoteId, companyId });

    if (quote.status !== 'draft') {
      throw new BadRequestException(
        'Can only update items on draft quotes/estimates',
      );
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, quoteId },
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

    return this.recalculateTotals({ id: quoteId, companyId });
  }

  async removeItem({
    quoteId,
    itemId,
    companyId,
  }: {
    quoteId: string;
    itemId: string;
    companyId: string;
  }): Promise<QuoteEntity> {
    const quote = await this.findById({ id: quoteId, companyId });

    if (quote.status !== 'draft') {
      throw new BadRequestException(
        'Can only remove items from draft quotes/estimates',
      );
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, quoteId },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    await this.itemRepository.remove(item);

    return this.recalculateTotals({ id: quoteId, companyId });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity } from '../invoice/invoice.entity';
import { QuoteEntity } from '../quote/quote.entity';
import { ClientEntity } from '../client/client.entity';
import { ProductEntity } from '../product/product.entity';
import { CreditNoteEntity } from '../credit-note/credit-note.entity';
import {
  CompanyStatsDto,
  InvoiceStatsDto,
  QuoteStatsDto,
  ClientStatsDto,
} from './dto';

interface StatusCountRow {
  status: string;
  count: string;
  totalAmount: string;
  totalBalance: string;
}

interface QuoteStatusCountRow {
  status: string;
  count: string;
  totalAmount: string;
}

interface OverdueRow {
  overdueAmount: string;
}

interface ClientInvoiceStatsRow {
  totalInvoices: string;
  totalInvoiced: string;
  totalPaid: string;
  outstandingBalance: string;
  overdueAmount: string;
  lastInvoiceDate: Date | null;
}

interface TopClientRow {
  clientId: string;
  clientName: string;
  totalInvoices: string;
  totalInvoiced: string;
  totalPaid: string;
  outstandingBalance: string;
  lastInvoiceDate: Date | null;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(QuoteEntity)
    private readonly quoteRepository: Repository<QuoteEntity>,
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepository: Repository<CreditNoteEntity>,
  ) {}

  async getCompanyStats(companyId: string): Promise<CompanyStatsDto> {
    const [invoiceStats, quoteStats, totalClients, totalProducts] =
      await Promise.all([
        this.getInvoiceStats(companyId),
        this.getQuoteStats(companyId),
        this.clientRepository.count({
          where: { companyId, isActive: true },
        }),
        this.productRepository.count({
          where: { companyId, isActive: true },
        }),
      ]);

    return {
      invoices: invoiceStats,
      quotes: quoteStats,
      totalClients,
      totalProducts,
    };
  }

  async getInvoiceStats(companyId: string): Promise<InvoiceStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get status counts
    const statusCounts = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(invoice.total)', 'totalAmount')
      .addSelect('SUM(invoice.balance)', 'totalBalance')
      .where('invoice.companyId = :companyId', { companyId })
      .groupBy('invoice.status')
      .getRawMany<StatusCountRow>();

    // Calculate stats from status counts
    let totalInvoices = 0;
    let draftCount = 0;
    let sentCount = 0;
    let paidCount = 0;
    let partialCount = 0;
    let overdueCount = 0;
    let totalRevenue = 0;
    let totalOutstanding = 0;

    for (const row of statusCounts) {
      const count = parseInt(row.count, 10);
      totalInvoices += count;

      switch (row.status) {
        case 'draft':
          draftCount = count;
          break;
        case 'sent':
        case 'viewed':
          sentCount += count;
          totalOutstanding += parseFloat(row.totalBalance || '0');
          break;
        case 'paid':
          paidCount = count;
          totalRevenue += parseFloat(row.totalAmount || '0');
          break;
        case 'partial':
          partialCount = count;
          totalOutstanding += parseFloat(row.totalBalance || '0');
          totalRevenue +=
            parseFloat(row.totalAmount || '0') -
            parseFloat(row.totalBalance || '0');
          break;
        case 'overdue':
          overdueCount = count;
          totalOutstanding += parseFloat(row.totalBalance || '0');
          break;
      }
    }

    // Get overdue amount (separate query for invoices past due date)
    const overdueResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balance)', 'overdueAmount')
      .where('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'viewed', 'partial', 'overdue'],
      })
      .andWhere('invoice.dueDate < :today', { today })
      .getRawOne<OverdueRow>();

    return {
      totalInvoices,
      draftCount,
      sentCount,
      paidCount,
      overdueCount,
      partialCount,
      totalRevenue,
      totalOutstanding,
      totalOverdue: parseFloat(overdueResult?.overdueAmount || '0'),
    };
  }

  async getQuoteStats(companyId: string): Promise<QuoteStatsDto> {
    const statusCounts = await this.quoteRepository
      .createQueryBuilder('quote')
      .select('quote.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(quote.total)', 'totalAmount')
      .where('quote.companyId = :companyId', { companyId })
      .groupBy('quote.status')
      .getRawMany<QuoteStatusCountRow>();

    let totalQuotes = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let convertedCount = 0;
    let totalAcceptedValue = 0;

    for (const row of statusCounts) {
      const count = parseInt(row.count, 10);
      totalQuotes += count;

      switch (row.status) {
        case 'draft':
        case 'sent':
        case 'viewed':
          pendingCount += count;
          break;
        case 'accepted':
          acceptedCount = count;
          totalAcceptedValue += parseFloat(row.totalAmount || '0');
          break;
        case 'rejected':
          rejectedCount = count;
          break;
        case 'converted':
          convertedCount = count;
          totalAcceptedValue += parseFloat(row.totalAmount || '0');
          break;
      }
    }

    // Calculate conversion rate
    const decisionsMade = acceptedCount + convertedCount + rejectedCount;
    const conversionRate =
      decisionsMade > 0
        ? ((acceptedCount + convertedCount) / decisionsMade) * 100
        : 0;

    return {
      totalQuotes,
      acceptedCount: acceptedCount + convertedCount, // Include converted as accepted
      rejectedCount,
      pendingCount,
      convertedCount,
      totalAcceptedValue,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  async getClientStats({
    clientId,
    companyId,
  }: {
    clientId: string;
    companyId: string;
  }): Promise<ClientStatsDto> {
    // Verify client exists
    const client = await this.clientRepository.findOne({
      where: { id: clientId, companyId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get invoice stats for client
    const invoiceStats = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(*)', 'totalInvoices')
      .addSelect('SUM(invoice.total)', 'totalInvoiced')
      .addSelect('SUM(invoice.amountPaid)', 'totalPaid')
      .addSelect('SUM(invoice.balance)', 'outstandingBalance')
      .addSelect('MAX(invoice.issueDate)', 'lastInvoiceDate')
      .where('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.clientId = :clientId', { clientId })
      .andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne<ClientInvoiceStatsRow>();

    // Get overdue amount
    const overdueStats = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.balance)', 'overdueAmount')
      .where('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.clientId = :clientId', { clientId })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['sent', 'viewed', 'partial', 'overdue'],
      })
      .andWhere('invoice.dueDate < :today', { today })
      .getRawOne<OverdueRow>();

    // Get quote count
    const quoteCount = await this.quoteRepository.count({
      where: { clientId, companyId },
    });

    // Get credit note count
    const creditNoteCount = await this.creditNoteRepository.count({
      where: { clientId, companyId },
    });

    return {
      clientId,
      clientName: client.name,
      totalInvoices: parseInt(invoiceStats?.totalInvoices || '0', 10),
      totalInvoiced: parseFloat(invoiceStats?.totalInvoiced || '0'),
      totalPaid: parseFloat(invoiceStats?.totalPaid || '0'),
      outstandingBalance: parseFloat(invoiceStats?.outstandingBalance || '0'),
      overdueAmount: parseFloat(overdueStats?.overdueAmount || '0'),
      totalQuotes: quoteCount,
      totalCreditNotes: creditNoteCount,
      lastInvoiceDate: invoiceStats?.lastInvoiceDate || undefined,
    };
  }

  async getTopClients({
    companyId,
    limit = 10,
    orderBy = 'totalInvoiced',
  }: {
    companyId: string;
    limit?: number;
    orderBy?: 'totalInvoiced' | 'totalPaid' | 'outstandingBalance';
  }): Promise<ClientStatsDto[]> {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('invoice.clientId', 'clientId')
      .addSelect('client.name', 'clientName')
      .addSelect('COUNT(*)', 'totalInvoices')
      .addSelect('COALESCE(SUM(invoice.total), 0)', 'totalInvoiced')
      .addSelect('COALESCE(SUM(invoice.amountPaid), 0)', 'totalPaid')
      .addSelect('COALESCE(SUM(invoice.balance), 0)', 'outstandingBalance')
      .addSelect('MAX(invoice.issueDate)', 'lastInvoiceDate')
      .innerJoin('invoice.client', 'client')
      .where('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('invoice.clientId')
      .addGroupBy('client.name')
      .orderBy(`"${orderBy}"`, 'DESC')
      .limit(limit);

    const results = await queryBuilder.getRawMany<TopClientRow>();

    return results.map((row: TopClientRow) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      totalInvoices: parseInt(row.totalInvoices || '0', 10),
      totalInvoiced: parseFloat(row.totalInvoiced || '0'),
      totalPaid: parseFloat(row.totalPaid || '0'),
      outstandingBalance: parseFloat(row.outstandingBalance || '0'),
      overdueAmount: 0, // Would need separate query for this
      totalQuotes: 0, // Would need separate query for this
      totalCreditNotes: 0, // Would need separate query for this
      lastInvoiceDate: row.lastInvoiceDate ?? undefined,
    }));
  }
}

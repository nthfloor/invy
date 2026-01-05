import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { InvoiceEntity } from '../invoice/invoice.entity';
import {
  PaymentEntity,
  PaymentAllocationEntity,
} from '../payment/payment.entity';
import { CreditNoteEntity } from '../credit-note/credit-note.entity';
import { ClientEntity } from '../client/client.entity';
import { CompanyEntity } from '../company/company.entity';
import {
  ClientStatementDto,
  StatementLineItemDto,
  InvoiceStatementDto,
  InvoiceLineItemStatusDto,
  InvoicePaymentDto,
} from './dto';

@Injectable()
export class StatementService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(PaymentAllocationEntity)
    private readonly allocationRepository: Repository<PaymentAllocationEntity>,
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepository: Repository<CreditNoteEntity>,
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async getClientStatement({
    clientId,
    companyId,
    startDate,
    endDate,
  }: {
    clientId: string;
    companyId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ClientStatementDto> {
    // Get client and company
    const client = await this.clientRepository.findOne({
      where: { id: clientId, companyId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Default to last 30 days if no dates provided
    const periodEnd = endDate || new Date();
    const periodStart =
      startDate || new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get opening balance (sum of all unpaid invoices before start date)
    const openingBalance = await this.calculateOpeningBalance({
      clientId,
      companyId,
      beforeDate: periodStart,
    });

    // Get all transactions in period
    const lineItems = await this.getTransactionsInPeriod({
      clientId,
      companyId,
      startDate: periodStart,
      endDate: periodEnd,
      openingBalance,
    });

    // Calculate totals
    let totalInvoiced = 0;
    let totalPayments = 0;
    let totalCredits = 0;

    for (const item of lineItems) {
      if (item.debit) totalInvoiced += item.debit;
      if (item.credit) {
        if (item.type === 'payment') totalPayments += item.credit;
        if (item.type === 'credit_note') totalCredits += item.credit;
      }
    }

    const closingBalance =
      lineItems.length > 0
        ? lineItems[lineItems.length - 1].balance
        : openingBalance;

    return {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      companyId: company.id,
      companyName: company.name,
      periodStart,
      periodEnd,
      openingBalance,
      lineItems,
      totalInvoiced,
      totalPayments,
      totalCredits,
      closingBalance,
      generatedAt: new Date(),
    };
  }

  private async calculateOpeningBalance({
    clientId,
    companyId,
    beforeDate,
  }: {
    clientId: string;
    companyId: string;
    beforeDate: Date;
  }): Promise<number> {
    // Sum of invoice balances before the period
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.balance), 0)', 'balance')
      .where('invoice.clientId = :clientId', { clientId })
      .andWhere('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.issueDate < :beforeDate', { beforeDate })
      .andWhere('invoice.status != :cancelled', { cancelled: 'cancelled' })
      .getRawOne<{ balance: string }>();

    return parseFloat(result?.balance ?? '0');
  }

  private async getTransactionsInPeriod({
    clientId,
    companyId,
    startDate,
    endDate,
    openingBalance,
  }: {
    clientId: string;
    companyId: string;
    startDate: Date;
    endDate: Date;
    openingBalance: number;
  }): Promise<StatementLineItemDto[]> {
    const transactions: StatementLineItemDto[] = [];

    // Get invoices in period
    const invoices = await this.invoiceRepository.find({
      where: {
        clientId,
        companyId,
        issueDate: Between(startDate, endDate),
      },
      order: { issueDate: 'ASC', createdOn: 'ASC' },
    });

    for (const invoice of invoices) {
      if (invoice.status !== 'cancelled') {
        transactions.push({
          date: invoice.issueDate,
          type: 'invoice',
          reference: invoice.invoiceNumber,
          description: `Invoice ${invoice.invoiceNumber}`,
          debit: Number(invoice.total),
          balance: 0, // Will be calculated later
        });
      }
    }

    // Get payments in period
    const payments = await this.paymentRepository.find({
      where: {
        clientId,
        companyId,
        paymentDate: Between(startDate, endDate),
        status: 'completed',
      },
      order: { paymentDate: 'ASC', createdOn: 'ASC' },
    });

    for (const payment of payments) {
      transactions.push({
        date: payment.paymentDate,
        type: 'payment',
        reference: payment.paymentNumber,
        description: `Payment ${payment.paymentNumber}${payment.reference ? ` (${payment.reference})` : ''}`,
        credit: Number(payment.amount),
        balance: 0, // Will be calculated later
      });
    }

    // Get credit notes in period
    const creditNotes = await this.creditNoteRepository.find({
      where: {
        clientId,
        companyId,
        issueDate: Between(startDate, endDate),
      },
      order: { issueDate: 'ASC', createdOn: 'ASC' },
    });

    for (const cn of creditNotes) {
      if (cn.status !== 'voided') {
        transactions.push({
          date: cn.issueDate,
          type: 'credit_note',
          reference: cn.creditNoteNumber,
          description: `Credit Note ${cn.creditNoteNumber}`,
          credit: Number(cn.total),
          balance: 0, // Will be calculated later
        });
      }
    }

    // Sort by date, then by type (invoices first, then payments/credits)
    transactions.sort((a, b) => {
      const dateCompare =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      // Invoices come before payments/credits on same day
      if (a.type === 'invoice' && b.type !== 'invoice') return -1;
      if (a.type !== 'invoice' && b.type === 'invoice') return 1;
      return 0;
    });

    // Calculate running balance
    let runningBalance = openingBalance;
    for (const transaction of transactions) {
      if (transaction.debit) {
        runningBalance += transaction.debit;
      }
      if (transaction.credit) {
        runningBalance -= transaction.credit;
      }
      transaction.balance = Math.round(runningBalance * 100) / 100;
    }

    return transactions;
  }

  async getInvoiceStatement({
    invoiceId,
    companyId,
  }: {
    invoiceId: string;
    companyId: string;
  }): Promise<InvoiceStatementDto> {
    // Get invoice with items
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, companyId },
      relations: ['items', 'client'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Get payments for this invoice
    const payments = await this.paymentRepository.find({
      where: { invoiceId, companyId, status: 'completed' },
      relations: ['allocations'],
      order: { paymentDate: 'ASC' },
    });

    // Build line item status with allocation info
    const lineItems: InvoiceLineItemStatusDto[] = [];
    const allocationsByItem: Record<string, number> = {};

    // Collect all allocations
    for (const payment of payments) {
      if (payment.allocations) {
        for (const alloc of payment.allocations) {
          allocationsByItem[alloc.invoiceItemId] =
            (allocationsByItem[alloc.invoiceItemId] || 0) +
            Number(alloc.amount);
        }
      }
    }

    // Calculate line item statuses
    const hasAllocations = Object.keys(allocationsByItem).length > 0;
    const totalPaid = Number(invoice.amountPaid);

    if (invoice.items) {
      // Sort items by sortOrder
      const sortedItems = [...invoice.items].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      for (const item of sortedItems) {
        const itemTotal = Number(item.lineTotal) + Number(item.lineTax);
        let amountPaid: number;

        if (hasAllocations) {
          // Use allocation data
          amountPaid = allocationsByItem[item.id] || 0;
        } else {
          // Prorate payments across all items
          const invoiceTotal = Number(invoice.total);
          amountPaid =
            invoiceTotal > 0 ? (itemTotal / invoiceTotal) * totalPaid : 0;
        }

        const amountRemaining = Math.max(0, itemTotal - amountPaid);

        lineItems.push({
          itemId: item.id,
          description: item.description,
          lineTotal: itemTotal,
          amountPaid: Math.round(amountPaid * 100) / 100,
          amountRemaining: Math.round(amountRemaining * 100) / 100,
          isPaid: amountRemaining < 0.01,
        });
      }
    }

    // Build payment list
    const paymentList: InvoicePaymentDto[] = payments.map((p) => ({
      paymentId: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      reference: p.reference,
    }));

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.client?.name || 'Unknown',
      invoiceDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      invoiceTotal: Number(invoice.total),
      lineItems,
      payments: paymentList,
      totalPaid: Number(invoice.amountPaid),
      balance: Number(invoice.balance),
      generatedAt: new Date(),
    };
  }
}

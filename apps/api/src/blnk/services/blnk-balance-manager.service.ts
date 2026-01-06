import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  BlnkBalanceMappingEntity,
  BalanceType,
} from '../entities/blnk-balance-mapping.entity';
import { BlnkClientService, BlnkTransaction } from './blnk-client.service';
import { DEFAULT_CURRENCY } from '../../shared/constants/currencies';

const SYSTEM_LEDGER_NAME = 'Invy';

// Re-export for consumers
export type { BlnkTransaction };

/**
 * Generate an idempotency key for ledger transactions
 * This prevents duplicate transactions when retrying failed requests
 */
function generateIdempotencyKey(params: {
  reference: string;
  amount: number;
  source: string;
  destination: string;
}): string {
  const data = `${params.reference}:${params.amount}:${params.source}:${params.destination}`;
  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

/**
 * Blnk Balance Manager Service
 *
 * High-level service for managing Blnk balances and recording transactions.
 * Handles:
 * - Lazy creation of client AR balances
 * - System balance management (revenue, cash)
 * - Invoice receivable recording
 * - Payment recording
 * - Transaction voiding for saga compensation
 */
@Injectable()
export class BlnkBalanceManagerService implements OnModuleInit {
  private readonly logger = new Logger(BlnkBalanceManagerService.name);
  private systemLedgerId: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(BlnkBalanceMappingEntity)
    private readonly mappingRepo: Repository<BlnkBalanceMappingEntity>,
    private readonly blnkClient: BlnkClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.blnkClient.isEnabled()) {
      this.logger.log('Blnk disabled - balance manager running in no-op mode');
      return;
    }

    this.initializationPromise = this.initialize();
    await this.initializationPromise;
  }

  /**
   * Check if Blnk integration is enabled
   */
  isEnabled(): boolean {
    return this.blnkClient.isEnabled();
  }

  private async initialize(): Promise<void> {
    try {
      await this.ensureSystemLedgerExists();
      await this.ensureSystemBalancesExist();
      this.logger.log('Blnk balance manager initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Blnk balance manager: ${error}`);
      // Don't throw - allow service to start, will retry on first use
    }
  }

  private async ensureSystemLedgerExists(): Promise<void> {
    // Check if we already have the ledger ID cached
    const existingMapping = await this.mappingRepo.findOne({
      where: { balanceType: 'revenue', clientId: IsNull() },
    });

    if (existingMapping) {
      this.systemLedgerId = existingMapping.ledgerId;
      this.logger.log(`Using existing system ledger: ${this.systemLedgerId}`);
      return;
    }

    // Create new ledger in Blnk
    const ledger = await this.blnkClient.createLedger({
      name: SYSTEM_LEDGER_NAME,
      metaData: {
        purpose: 'Invy invoicing system ledger',
        created_by: 'blnk-balance-manager',
      },
    });

    this.systemLedgerId = ledger.ledger_id;
    this.logger.log(`Created system ledger: ${this.systemLedgerId}`);
  }

  private async ensureSystemBalancesExist(): Promise<void> {
    if (!this.systemLedgerId) {
      throw new Error('System ledger not initialized');
    }

    // Ensure revenue balance exists
    await this.getOrCreateSystemBalance('revenue');

    // Ensure cash balance exists
    await this.getOrCreateSystemBalance('cash');
  }

  private async getOrCreateSystemBalance(
    balanceType: 'revenue' | 'cash',
  ): Promise<string> {
    // Check database first (system balances have null clientId)
    const existing = await this.mappingRepo.findOne({
      where: { balanceType, clientId: IsNull() },
    });

    if (existing) {
      return existing.blnkBalanceId;
    }

    if (!this.systemLedgerId) {
      await this.ensureSystemLedgerExists();
    }

    // Create in Blnk
    const balance = await this.blnkClient.createBalance({
      ledgerId: this.systemLedgerId!,
      currency: DEFAULT_CURRENCY,
      metaData: {
        type: balanceType,
        system_balance: true,
      },
    });

    // Persist mapping
    await this.mappingRepo.save({
      id: uuidv4(),
      blnkBalanceId: balance.balance_id,
      balanceType,
      ledgerId: this.systemLedgerId!,
      currency: DEFAULT_CURRENCY,
    });

    this.logger.log(
      `Created system balance: ${balanceType} -> ${balance.balance_id}`,
    );
    return balance.balance_id;
  }

  // ============================================
  // Balance Retrieval (Lazy Creation)
  // ============================================

  /**
   * Get or create the accounts receivable balance for a client
   * This implements lazy creation - balance is created on first transaction
   */
  async getClientARBalance(
    clientId: string,
    companyId?: string,
  ): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    // Ensure initialization is complete
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    if (!this.systemLedgerId) {
      await this.ensureSystemLedgerExists();
    }

    // Check database first
    const existing = await this.mappingRepo.findOne({
      where: { clientId, balanceType: 'accounts_receivable' },
    });

    if (existing) {
      return existing.blnkBalanceId;
    }

    // Create in Blnk
    const balance = await this.blnkClient.createBalance({
      ledgerId: this.systemLedgerId!,
      currency: DEFAULT_CURRENCY,
      metaData: {
        client_id: clientId,
        company_id: companyId,
        type: 'accounts_receivable',
      },
    });

    // Persist mapping
    await this.mappingRepo.save({
      id: uuidv4(),
      clientId,
      companyId,
      blnkBalanceId: balance.balance_id,
      balanceType: 'accounts_receivable' as BalanceType,
      ledgerId: this.systemLedgerId!,
      currency: DEFAULT_CURRENCY,
    });

    this.logger.log(
      `Created AR balance for client ${clientId}: ${balance.balance_id}`,
    );
    return balance.balance_id;
  }

  /**
   * Get the revenue balance ID (system-wide)
   */
  async getRevenueBalance(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    const mapping = await this.mappingRepo.findOne({
      where: { balanceType: 'revenue', clientId: IsNull() },
    });

    if (!mapping) {
      return this.getOrCreateSystemBalance('revenue');
    }

    return mapping.blnkBalanceId;
  }

  /**
   * Get the cash balance ID (system-wide)
   */
  async getCashBalance(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    const mapping = await this.mappingRepo.findOne({
      where: { balanceType: 'cash', clientId: IsNull() },
    });

    if (!mapping) {
      return this.getOrCreateSystemBalance('cash');
    }

    return mapping.blnkBalanceId;
  }

  /**
   * Get the current balance for a client
   */
  async getClientBalance(clientId: string): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    const mapping = await this.mappingRepo.findOne({
      where: { clientId, balanceType: 'accounts_receivable' },
    });

    if (!mapping) {
      return 0; // No balance created yet
    }

    const balance = await this.blnkClient.getBalance(mapping.blnkBalanceId);
    return balance.balance;
  }

  // ============================================
  // Transaction Recording
  // ============================================

  /**
   * Record an invoice receivable (debit to accounts receivable, credit to revenue)
   * Called when an invoice is sent
   */
  async recordInvoiceReceivable(params: {
    invoiceId: string;
    clientId: string;
    companyId: string;
    amount: number;
    currency?: string;
    description?: string;
  }): Promise<BlnkTransaction> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    this.logger.log(`Recording receivable for invoice: ${params.invoiceId}`);

    // Get or create actual Blnk balance IDs
    const [accountsReceivableBalanceId, revenueBalanceId] = await Promise.all([
      this.getClientARBalance(params.clientId, params.companyId),
      this.getRevenueBalance(),
    ]);

    // Generate idempotency key to prevent duplicate transactions on retry
    const idempotencyKey = generateIdempotencyKey({
      reference: `INV-${params.invoiceId}`,
      amount: params.amount,
      source: revenueBalanceId,
      destination: accountsReceivableBalanceId,
    });

    return this.blnkClient.recordTransaction(
      {
        amount: params.amount,
        reference: `INV-${params.invoiceId}`,
        currency: params.currency ?? DEFAULT_CURRENCY,
        source: revenueBalanceId,
        destination: accountsReceivableBalanceId,
        description:
          params.description || `Invoice ${params.invoiceId} receivable`,
        metaData: {
          invoice_id: params.invoiceId,
          client_id: params.clientId,
          company_id: params.companyId,
          transaction_type: 'invoice_receivable',
        },
      },
      idempotencyKey,
    );
  }

  /**
   * Record a payment received (credit to accounts receivable, debit to cash)
   * Called when a payment is received
   */
  async recordPaymentReceived(params: {
    paymentId: string;
    invoiceId: string;
    clientId: string;
    companyId: string;
    amount: number;
    currency?: string;
    description?: string;
  }): Promise<BlnkTransaction> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    this.logger.log(`Recording payment for invoice: ${params.invoiceId}`);

    // Get or create actual Blnk balance IDs
    const [accountsReceivableBalanceId, cashBalanceId] = await Promise.all([
      this.getClientARBalance(params.clientId, params.companyId),
      this.getCashBalance(),
    ]);

    // Generate idempotency key to prevent duplicate transactions on retry
    const idempotencyKey = generateIdempotencyKey({
      reference: `PMT-${params.paymentId}`,
      amount: params.amount,
      source: accountsReceivableBalanceId,
      destination: cashBalanceId,
    });

    return this.blnkClient.recordTransaction(
      {
        amount: params.amount,
        reference: `PMT-${params.paymentId}`,
        currency: params.currency ?? DEFAULT_CURRENCY,
        source: accountsReceivableBalanceId,
        destination: cashBalanceId,
        description:
          params.description ||
          `Payment ${params.paymentId} for invoice ${params.invoiceId}`,
        metaData: {
          payment_id: params.paymentId,
          invoice_id: params.invoiceId,
          client_id: params.clientId,
          company_id: params.companyId,
          transaction_type: 'payment_received',
        },
      },
      idempotencyKey,
    );
  }

  /**
   * Record a credit note (debit to revenue, credit to accounts receivable)
   * Called when a credit note is issued
   */
  async recordCreditNote(params: {
    creditNoteId: string;
    invoiceId: string;
    clientId: string;
    companyId: string;
    amount: number;
    currency?: string;
    description?: string;
  }): Promise<BlnkTransaction> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    this.logger.log(`Recording credit note: ${params.creditNoteId}`);

    // Get or create actual Blnk balance IDs
    const [accountsReceivableBalanceId, revenueBalanceId] = await Promise.all([
      this.getClientARBalance(params.clientId, params.companyId),
      this.getRevenueBalance(),
    ]);

    // Generate idempotency key to prevent duplicate transactions on retry
    const idempotencyKey = generateIdempotencyKey({
      reference: `CN-${params.creditNoteId}`,
      amount: params.amount,
      source: accountsReceivableBalanceId,
      destination: revenueBalanceId,
    });

    // Credit note is reverse of invoice: AR -> Revenue
    return this.blnkClient.recordTransaction(
      {
        amount: params.amount,
        reference: `CN-${params.creditNoteId}`,
        currency: params.currency ?? DEFAULT_CURRENCY,
        source: accountsReceivableBalanceId,
        destination: revenueBalanceId,
        description:
          params.description ||
          `Credit note ${params.creditNoteId} for invoice ${params.invoiceId}`,
        metaData: {
          credit_note_id: params.creditNoteId,
          invoice_id: params.invoiceId,
          client_id: params.clientId,
          company_id: params.companyId,
          transaction_type: 'credit_note',
        },
      },
      idempotencyKey,
    );
  }

  /**
   * Void a transaction (for saga compensation)
   * Blnk uses reversals rather than deletions
   */
  async voidTransaction(
    transactionId: string,
    reason: string,
  ): Promise<BlnkTransaction> {
    if (!this.isEnabled()) {
      throw new Error('Blnk integration is disabled');
    }

    this.logger.log(`Voiding transaction: ${transactionId}`);

    // Get the original transaction
    const original = await this.blnkClient.getTransaction(transactionId);

    // Generate idempotency key to prevent duplicate void transactions on retry
    const idempotencyKey = generateIdempotencyKey({
      reference: `VOID-${transactionId}`,
      amount: original.amount,
      source: original.destination,
      destination: original.source,
    });

    // Create a reversal transaction
    return this.blnkClient.recordTransaction(
      {
        amount: original.amount,
        reference: `VOID-${transactionId}`,
        currency: original.currency,
        source: original.destination, // Reverse the flow
        destination: original.source,
        description: `Void: ${reason}`,
        metaData: {
          original_transaction_id: transactionId,
          void_reason: reason,
          transaction_type: 'void',
        },
      },
      idempotencyKey,
    );
  }
}

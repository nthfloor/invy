import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  createPaymentRecordingSaga,
  PaymentRecordingContext,
  PaymentRecordingActors,
} from '../machines';
import { WorkflowExecutorService } from './workflow-executor.service';
import { BlnkBalanceManagerService } from '../../blnk/services/blnk-balance-manager.service';
import { InvoiceEntity } from '../../invoice/invoice.entity';
import { PaymentEntity, PaymentMethod } from '../../payment/payment.entity';

export interface PaymentWorkflowInput {
  paymentId: string;
  invoiceId: string;
  clientId: string;
  companyId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  correlationId?: string;
}

export interface PaymentWorkflowResult {
  success: boolean;
  finalState: string;
  blnkTransactionId?: string;
  invoiceNewStatus?: 'partial' | 'paid';
  invoiceNewBalance?: number;
  error?: string;
}

/**
 * Payment Workflow Service
 *
 * Orchestrates payment recording using XState saga with Blnk integration.
 * Implements the saga pattern:
 * 1. Record payment in Blnk (if enabled)
 * 2. Update invoice in Invy
 * 3. Compensate (void Blnk transaction) if Invy update fails
 */
@Injectable()
export class PaymentWorkflowService {
  private readonly logger = new Logger(PaymentWorkflowService.name);

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly workflowExecutor: WorkflowExecutorService,
    private readonly blnkBalanceManager: BlnkBalanceManagerService,
  ) {}

  /**
   * Create Blnk-aware actors for the payment recording saga
   */
  private createActors(): PaymentRecordingActors {
    const blnkEnabled = this.blnkBalanceManager.isEnabled();

    return {
      recordPaymentInBlnk: async (context: PaymentRecordingContext) => {
        if (!blnkEnabled) {
          return { blnkTransactionId: '' };
        }

        this.logger.log(
          `Recording payment in Blnk for invoice: ${context.invoiceId}`,
        );
        const transaction = await this.blnkBalanceManager.recordPaymentReceived(
          {
            paymentId: context.paymentId,
            invoiceId: context.invoiceId,
            clientId: context.clientId,
            companyId: context.companyId,
            amount: context.amount,
            currency: context.currency,
          },
        );

        return { blnkTransactionId: transaction.transaction_id };
      },

      recordPaymentInInvy: async (context: PaymentRecordingContext) => {
        this.logger.log(
          `Recording payment in Invy for invoice: ${context.invoiceId}`,
        );

        // Get current invoice
        const invoice = await this.invoiceRepository.findOneOrFail({
          where: { id: context.invoiceId },
        });

        // Calculate new amounts
        const newAmountPaid = Number(invoice.amountPaid) + context.amount;
        const newBalance = Number(invoice.total) - newAmountPaid;
        const newStatus: 'partial' | 'paid' =
          newBalance <= 0 ? 'paid' : 'partial';

        // Update invoice
        await this.invoiceRepository.update(context.invoiceId, {
          amountPaid: newAmountPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
        });

        // Create payment record
        await this.paymentRepository.save({
          id: context.paymentId,
          companyId: context.companyId,
          clientId: context.clientId,
          invoiceId: context.invoiceId,
          paymentNumber: `PAY-${Date.now()}`, // Should use proper sequence
          amount: context.amount,
          paymentMethod: context.paymentMethod as PaymentMethod,
          status: 'completed',
          paymentDate: context.paymentDate,
          reference: context.reference,
          notes: context.notes,
        });

        this.logger.log(
          `Payment ${context.paymentId} recorded. Invoice status: ${newStatus}, balance: ${newBalance}`,
        );

        return {
          invoiceNewStatus: newStatus,
          invoiceNewBalance: Math.max(0, newBalance),
        };
      },

      voidBlnkTransaction: async (context: PaymentRecordingContext) => {
        if (!blnkEnabled || !context.blnkTransactionId) {
          return;
        }

        this.logger.log(
          `Voiding Blnk transaction: ${context.blnkTransactionId}`,
        );
        await this.blnkBalanceManager.voidTransaction(
          context.blnkTransactionId,
          `Payment ${context.paymentId} failed in Invy`,
        );
      },
    };
  }

  /**
   * Build the payment context from input
   */
  private buildContext(input: PaymentWorkflowInput): PaymentRecordingContext {
    return {
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      clientId: input.clientId,
      companyId: input.companyId,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      paymentDate: input.paymentDate,
      reference: input.reference,
      notes: input.notes,
      blnkEnabled: this.blnkBalanceManager.isEnabled(),
      correlationId: input.correlationId ?? uuidv4(),
    };
  }

  /**
   * Record a payment using the saga
   */
  async recordPayment(
    input: PaymentWorkflowInput,
  ): Promise<PaymentWorkflowResult> {
    const context = this.buildContext(input);
    const actors = this.createActors();
    const machine = createPaymentRecordingSaga(actors);

    // Execute the saga
    const result = await this.workflowExecutor.execute<
      PaymentRecordingContext,
      PaymentRecordingContext
    >({
      machine,
      input: context,
      workflowType: 'payment',
      entityType: 'payment',
      entityId: input.paymentId,
      companyId: input.companyId,
      correlationId: context.correlationId,
    });

    return {
      success: result.success,
      finalState: result.finalState,
      blnkTransactionId: result.context.blnkTransactionId,
      invoiceNewStatus: result.context.invoiceNewStatus,
      invoiceNewBalance: result.context.invoiceNewBalance,
      error: result.error,
    };
  }
}

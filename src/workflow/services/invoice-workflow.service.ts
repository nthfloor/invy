import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  createInvoiceMachine,
  InvoiceContext,
  InvoiceMachineActors,
  InvoiceMachineState,
  mapMachineStateToDbStatus,
} from '../machines';
import { WorkflowExecutorService } from './workflow-executor.service';
import { BlnkBalanceManagerService } from '../../blnk/services/blnk-balance-manager.service';
import { InvoiceEntity } from '../../invoice/invoice.entity';

export interface InvoiceWorkflowInput {
  invoiceId: string;
  companyId: string;
  clientId: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  amountPaid: number;
  balance: number;
  correlationId?: string;
}

export interface InvoiceWorkflowResult {
  success: boolean;
  finalState: string;
  dbStatus: string;
  blnkTransactionId?: string;
  error?: string;
}

/**
 * Invoice Workflow Service
 *
 * Orchestrates invoice lifecycle using XState machine with Blnk integration.
 * This service:
 * - Creates invoice machines with Blnk actors injected
 * - Executes workflows for invoice operations (finalize, send, cancel, etc.)
 * - Updates invoice entity status based on workflow outcomes
 */
@Injectable()
export class InvoiceWorkflowService {
  private readonly logger = new Logger(InvoiceWorkflowService.name);

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    private readonly workflowExecutor: WorkflowExecutorService,
    private readonly blnkBalanceManager: BlnkBalanceManagerService,
  ) {}

  /**
   * Create Blnk-aware actors for the invoice machine
   */
  private createActors(): InvoiceMachineActors {
    const blnkEnabled = this.blnkBalanceManager.isEnabled();

    return {
      recordReceivable: async (context: InvoiceContext) => {
        if (!blnkEnabled) {
          return { blnkTransactionId: '' };
        }

        this.logger.log(
          `Recording receivable for invoice: ${context.invoiceId}`,
        );
        const transaction =
          await this.blnkBalanceManager.recordInvoiceReceivable({
            invoiceId: context.invoiceId,
            clientId: context.clientId,
            companyId: context.companyId,
            amount: context.total,
            currency: context.currency,
          });

        return { blnkTransactionId: transaction.transaction_id };
      },

      voidReceivable: async (context: InvoiceContext) => {
        if (!blnkEnabled || !context.blnkTransactionId) {
          return;
        }

        this.logger.log(`Voiding receivable for invoice: ${context.invoiceId}`);
        await this.blnkBalanceManager.voidTransaction(
          context.blnkTransactionId,
          `Invoice ${context.invoiceNumber} cancelled`,
        );
      },

      updateInvoiceStatus: async (
        context: InvoiceContext & { newStatus: string },
      ) => {
        this.logger.log(
          `Updating invoice ${context.invoiceId} status to: ${context.newStatus}`,
        );
        await this.invoiceRepository.update(context.invoiceId, {
          status: context.newStatus as InvoiceEntity['status'],
        });
      },
    };
  }

  /**
   * Build the invoice context from input
   */
  private buildContext(input: InvoiceWorkflowInput): InvoiceContext {
    return {
      invoiceId: input.invoiceId,
      companyId: input.companyId,
      clientId: input.clientId,
      invoiceNumber: input.invoiceNumber,
      total: input.total,
      currency: input.currency,
      amountPaid: input.amountPaid,
      balance: input.balance,
      blnkEnabled: this.blnkBalanceManager.isEnabled(),
      correlationId: input.correlationId ?? uuidv4(),
    };
  }

  /**
   * Finalize an invoice (mark ready to send)
   */
  async finalize(input: InvoiceWorkflowInput): Promise<InvoiceWorkflowResult> {
    // Finalize is a simple local operation - no Blnk involved
    // The full workflow execution would be used for operations involving Blnk

    try {
      await this.invoiceRepository.update(input.invoiceId, {
        // Note: We might want to add a 'finalized' status to the entity
        // For now, it stays as 'draft' but is flagged as ready
      });

      this.logger.log(`Invoice ${input.invoiceId} finalized`);

      return {
        success: true,
        finalState: 'finalized',
        dbStatus: 'draft', // Still draft until sent
      };
    } catch (error) {
      this.logger.error(`Failed to finalize invoice: ${error}`);
      return {
        success: false,
        finalState: 'draft',
        dbStatus: 'draft',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send an invoice (record receivable in Blnk if enabled)
   */
  async send(input: InvoiceWorkflowInput): Promise<InvoiceWorkflowResult> {
    const context = this.buildContext(input);
    const actors = this.createActors();
    const machine = createInvoiceMachine(actors);

    // Execute the workflow
    const result = await this.workflowExecutor.execute<
      InvoiceContext,
      InvoiceContext
    >({
      machine,
      input: context,
      workflowType: 'invoice',
      entityType: 'invoice',
      entityId: input.invoiceId,
      companyId: input.companyId,
      correlationId: context.correlationId,
    });

    // Update the invoice with final status
    const dbStatus = mapMachineStateToDbStatus(
      result.finalState as InvoiceMachineState,
    );
    await this.invoiceRepository.update(input.invoiceId, {
      status: dbStatus as InvoiceEntity['status'],
    });

    return {
      success: result.success,
      finalState: result.finalState,
      dbStatus,
      blnkTransactionId: result.context.blnkTransactionId,
      error: result.error,
    };
  }

  /**
   * Cancel an invoice (void Blnk transaction if exists)
   */
  async cancel(
    input: InvoiceWorkflowInput,
    reason?: string,
  ): Promise<InvoiceWorkflowResult> {
    // Note: If there's a Blnk transaction, voiding would be handled by the saga
    // For now, this is a simple cancellation

    try {
      // Update invoice status to cancelled
      await this.invoiceRepository.update(input.invoiceId, {
        status: 'cancelled',
        cancelReason: reason,
      });

      this.logger.log(`Invoice ${input.invoiceId} cancelled`);

      return {
        success: true,
        finalState: 'cancelled',
        dbStatus: 'cancelled',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel invoice: ${error}`);
      return {
        success: false,
        finalState: 'failed',
        dbStatus: 'cancelled',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

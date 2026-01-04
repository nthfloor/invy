import { setup, fromPromise, assign } from 'xstate';

/**
 * Invoice Lifecycle State Machine
 *
 * States:
 * - draft: Initial state, invoice can be edited
 * - finalized: User has confirmed the invoice, ready to send
 * - recordingReceivable: Recording the receivable in Blnk (if enabled)
 * - sent: Invoice has been sent to client
 * - viewed: Client has viewed the invoice
 * - partial: Partial payment received
 * - paid: Fully paid (terminal state)
 * - cancelled: Voided/cancelled (terminal state)
 * - compensating: Rolling back Blnk transaction on failure
 * - failed: Operation failed (terminal state)
 * - failedWithInconsistency: Critical failure requiring manual intervention
 *
 * Events:
 * - FINALIZE: Confirm the invoice is ready to send
 * - SEND: Send the invoice to the client
 * - VIEW: Client viewed the invoice
 * - RECORD_PAYMENT: Record a payment
 * - CANCEL: Cancel the invoice
 */

export interface InvoiceContext {
  // Invoice identification
  invoiceId: string;
  companyId: string;
  clientId: string;
  invoiceNumber: string;

  // Financial data
  total: number;
  currency: string;
  amountPaid: number;
  balance: number;

  // Blnk integration (optional)
  blnkEnabled: boolean;
  blnkTransactionId?: string;

  // Workflow metadata
  correlationId: string;

  // Error tracking
  error?: string;

  // Cancel reason
  cancelReason?: string;
}

export type InvoiceEvent =
  | { type: 'FINALIZE' }
  | { type: 'SEND' }
  | { type: 'VIEW' }
  | { type: 'RECORD_PAYMENT'; amount: number }
  | { type: 'CANCEL'; reason?: string };

export interface InvoiceMachineActors {
  recordReceivable: (
    input: InvoiceContext,
  ) => Promise<{ blnkTransactionId: string }>;
  voidReceivable: (input: InvoiceContext) => Promise<void>;
  updateInvoiceStatus: (
    input: InvoiceContext & { newStatus: string },
  ) => Promise<void>;
}

/**
 * Create the invoice state machine with injected actors
 * This allows the machine to work both with and without Blnk integration
 */
export function createInvoiceMachine(
  actors: Partial<InvoiceMachineActors> = {},
) {
  // Default no-op actors for standalone mode
  const defaultActors: InvoiceMachineActors = {
    recordReceivable: () => Promise.resolve({ blnkTransactionId: '' }),
    voidReceivable: () => Promise.resolve(),
    updateInvoiceStatus: () => Promise.resolve(),
    ...actors,
  };

  return setup({
    types: {
      context: {} as InvoiceContext,
      input: {} as InvoiceContext,
      events: {} as InvoiceEvent,
    },
    actors: {
      recordReceivable: fromPromise<
        { blnkTransactionId: string },
        InvoiceContext
      >(async ({ input }) => defaultActors.recordReceivable(input)),

      voidReceivable: fromPromise<void, InvoiceContext>(async ({ input }) =>
        defaultActors.voidReceivable(input),
      ),

      updateInvoiceStatus: fromPromise<
        void,
        InvoiceContext & { newStatus: string }
      >(async ({ input }) => defaultActors.updateInvoiceStatus(input)),
    },
    guards: {
      isBlnkEnabled: ({ context }) => context.blnkEnabled,
      isBlnkDisabled: ({ context }) => !context.blnkEnabled,
      isFullyPaid: ({ context, event }) => {
        if (event.type !== 'RECORD_PAYMENT') return false;
        const newBalance = context.balance - event.amount;
        return newBalance <= 0;
      },
      isPartialPayment: ({ context, event }) => {
        if (event.type !== 'RECORD_PAYMENT') return false;
        const newBalance = context.balance - event.amount;
        return newBalance > 0;
      },
      canCancel: ({ context }) => {
        // Cannot cancel if already paid or cancelled
        return context.amountPaid <= 0;
      },
      hasBlnkTransaction: ({ context }) => !!context.blnkTransactionId,
    },
    actions: {
      storeBlnkTransactionId: assign({
        blnkTransactionId: (_, params: { blnkTransactionId: string }) =>
          params.blnkTransactionId,
      }),
      recordPaymentAmount: assign({
        amountPaid: ({ context, event }) => {
          if (event.type !== 'RECORD_PAYMENT') return context.amountPaid;
          return context.amountPaid + event.amount;
        },
        balance: ({ context, event }) => {
          if (event.type !== 'RECORD_PAYMENT') return context.balance;
          return Math.max(0, context.balance - event.amount);
        },
      }),
      storeCancelReason: assign({
        cancelReason: ({ event }) => {
          if (event.type !== 'CANCEL') return undefined;
          return event.reason;
        },
      }),
      storeError: assign({
        error: (_, params: { error: unknown }) => {
          if (params.error instanceof Error) return params.error.message;
          return String(params.error);
        },
      }),
      appendCompensationError: assign({
        error: ({ context }, params: { error: unknown }) => {
          const compensationError =
            params.error instanceof Error
              ? params.error.message
              : String(params.error);
          return `${context.error}. Compensation also failed: ${compensationError}`;
        },
      }),
    },
  }).createMachine({
    id: 'invoice',
    initial: 'draft',
    context: ({ input }) => ({
      ...input,
    }),
    states: {
      // Initial editable state
      draft: {
        on: {
          FINALIZE: {
            target: 'finalized',
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['storeCancelReason'],
          },
        },
      },

      // Confirmed, ready to send
      finalized: {
        on: {
          SEND: [
            {
              // If Blnk is enabled, record receivable first
              guard: 'isBlnkEnabled',
              target: 'recordingReceivable',
            },
            {
              // If Blnk is disabled, go directly to sent
              guard: 'isBlnkDisabled',
              target: 'sent',
            },
          ],
          CANCEL: {
            target: 'cancelled',
            actions: ['storeCancelReason'],
          },
        },
      },

      // Recording the receivable in Blnk
      recordingReceivable: {
        invoke: {
          src: 'recordReceivable',
          input: ({ context }) => context,
          onDone: {
            target: 'sent',
            actions: [
              {
                type: 'storeBlnkTransactionId',
                params: ({ event }) => ({
                  blnkTransactionId: event.output.blnkTransactionId,
                }),
              },
            ],
          },
          onError: {
            target: 'finalized',
            actions: [
              {
                type: 'storeError',
                params: ({ event }) => ({ error: event.error }),
              },
            ],
          },
        },
      },

      // Sent to client
      sent: {
        on: {
          VIEW: {
            target: 'viewed',
          },
          RECORD_PAYMENT: [
            {
              guard: 'isFullyPaid',
              target: 'paid',
              actions: ['recordPaymentAmount'],
            },
            {
              guard: 'isPartialPayment',
              target: 'partial',
              actions: ['recordPaymentAmount'],
            },
          ],
          CANCEL: [
            {
              guard: 'hasBlnkTransaction',
              target: 'compensating',
              actions: ['storeCancelReason'],
            },
            {
              target: 'cancelled',
              actions: ['storeCancelReason'],
            },
          ],
        },
      },

      // Client has viewed the invoice
      viewed: {
        on: {
          RECORD_PAYMENT: [
            {
              guard: 'isFullyPaid',
              target: 'paid',
              actions: ['recordPaymentAmount'],
            },
            {
              guard: 'isPartialPayment',
              target: 'partial',
              actions: ['recordPaymentAmount'],
            },
          ],
          CANCEL: [
            {
              guard: 'hasBlnkTransaction',
              target: 'compensating',
              actions: ['storeCancelReason'],
            },
            {
              target: 'cancelled',
              actions: ['storeCancelReason'],
            },
          ],
        },
      },

      // Partial payment received
      partial: {
        on: {
          RECORD_PAYMENT: [
            {
              guard: 'isFullyPaid',
              target: 'paid',
              actions: ['recordPaymentAmount'],
            },
            {
              actions: ['recordPaymentAmount'],
            },
          ],
          CANCEL: [
            {
              guard: 'hasBlnkTransaction',
              target: 'compensating',
              actions: ['storeCancelReason'],
            },
            {
              target: 'cancelled',
              actions: ['storeCancelReason'],
            },
          ],
        },
      },

      // Compensating (voiding Blnk transaction)
      compensating: {
        invoke: {
          src: 'voidReceivable',
          input: ({ context }) => context,
          onDone: {
            target: 'cancelled',
          },
          onError: {
            target: 'failedWithInconsistency',
            actions: [
              {
                type: 'appendCompensationError',
                params: ({ event }) => ({ error: event.error }),
              },
            ],
          },
        },
      },

      // Terminal states
      paid: {
        type: 'final',
      },

      cancelled: {
        type: 'final',
      },

      failed: {
        type: 'final',
      },

      failedWithInconsistency: {
        type: 'final',
      },
    },
  });
}

/**
 * Invoice status type derived from the machine states
 * Note: This differs from the database InvoiceStatus as it includes
 * workflow-specific states like 'finalized', 'recordingReceivable', etc.
 */
export type InvoiceMachineState =
  | 'draft'
  | 'finalized'
  | 'recordingReceivable'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'cancelled'
  | 'compensating'
  | 'failed'
  | 'failedWithInconsistency';

/**
 * Map machine states to database statuses
 */
export function mapMachineStateToDbStatus(
  machineState: InvoiceMachineState,
): string {
  const mapping: Record<InvoiceMachineState, string> = {
    draft: 'draft',
    finalized: 'draft', // Still draft in DB until sent
    recordingReceivable: 'draft', // Transient state
    sent: 'sent',
    viewed: 'viewed',
    partial: 'partial',
    paid: 'paid',
    cancelled: 'cancelled',
    compensating: 'cancelled', // Transient state
    failed: 'cancelled',
    failedWithInconsistency: 'cancelled',
  };
  return mapping[machineState] ?? 'draft';
}

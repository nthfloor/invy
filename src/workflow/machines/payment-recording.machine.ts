import { setup, fromPromise, assign } from 'xstate';

/**
 * Payment Recording Saga
 *
 * This saga coordinates recording a payment in Invy and optionally in Blnk.
 * It implements the saga pattern with compensation on failure.
 *
 * Flow (with Blnk enabled):
 * 1. Record payment in Blnk (source of truth for financial transactions)
 * 2. Record payment in Invy (update invoice balance/status)
 * 3. If Invy fails, compensate by voiding the Blnk transaction
 *
 * Flow (without Blnk):
 * 1. Record payment in Invy
 *
 * States:
 * - recordingPaymentInBlnk: Recording in Blnk (if enabled)
 * - recordingPaymentInInvy: Recording in Invy
 * - completed: Payment recorded successfully (terminal state)
 * - compensatingBlnk: Voiding Blnk transaction on failure
 * - failed: Recording failed (terminal state)
 * - failedWithInconsistency: Critical failure requiring manual intervention
 */

export interface PaymentRecordingContext {
  // Payment identification
  paymentId: string;
  companyId: string;
  clientId: string;
  invoiceId: string;

  // Payment details
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: Date;
  reference?: string;
  notes?: string;

  // Blnk integration
  blnkEnabled: boolean;
  blnkTransactionId?: string;

  // Invoice state after payment
  invoiceNewStatus?: 'partial' | 'paid';
  invoiceNewBalance?: number;

  // Workflow metadata
  correlationId: string;

  // Error tracking
  error?: string;
}

export type PaymentRecordingEvent = { type: 'START' } | { type: 'RETRY' };

export interface PaymentRecordingActors {
  recordPaymentInBlnk: (
    input: PaymentRecordingContext,
  ) => Promise<{ blnkTransactionId: string }>;
  recordPaymentInInvy: (input: PaymentRecordingContext) => Promise<{
    invoiceNewStatus: 'partial' | 'paid';
    invoiceNewBalance: number;
  }>;
  voidBlnkTransaction: (input: PaymentRecordingContext) => Promise<void>;
}

/**
 * Create the payment recording saga with injected actors
 */
export function createPaymentRecordingSaga(
  actors: Partial<PaymentRecordingActors> = {},
) {
  // Default no-op actors for standalone mode
  const defaultActors: PaymentRecordingActors = {
    recordPaymentInBlnk: () => Promise.resolve({ blnkTransactionId: '' }),
    recordPaymentInInvy: () =>
      Promise.resolve({
        invoiceNewStatus: 'partial' as const,
        invoiceNewBalance: 0,
      }),
    voidBlnkTransaction: () => Promise.resolve(),
    ...actors,
  };

  return setup({
    types: {
      context: {} as PaymentRecordingContext,
      input: {} as PaymentRecordingContext,
      events: {} as PaymentRecordingEvent,
    },
    actors: {
      recordPaymentInBlnk: fromPromise<
        { blnkTransactionId: string },
        PaymentRecordingContext
      >(async ({ input }) => defaultActors.recordPaymentInBlnk(input)),

      recordPaymentInInvy: fromPromise<
        { invoiceNewStatus: 'partial' | 'paid'; invoiceNewBalance: number },
        PaymentRecordingContext
      >(async ({ input }) => defaultActors.recordPaymentInInvy(input)),

      voidBlnkTransaction: fromPromise<void, PaymentRecordingContext>(
        async ({ input }) => defaultActors.voidBlnkTransaction(input),
      ),
    },
    guards: {
      isBlnkEnabled: ({ context }) => context.blnkEnabled,
      isBlnkDisabled: ({ context }) => !context.blnkEnabled,
      hasBlnkTransaction: ({ context }) => !!context.blnkTransactionId,
    },
    actions: {
      storeBlnkTransactionId: assign({
        blnkTransactionId: (_, params: { blnkTransactionId: string }) =>
          params.blnkTransactionId,
      }),
      storeInvoiceUpdate: assign({
        invoiceNewStatus: (
          _,
          params: {
            invoiceNewStatus: 'partial' | 'paid';
            invoiceNewBalance: number;
          },
        ) => params.invoiceNewStatus,
        invoiceNewBalance: (
          _,
          params: {
            invoiceNewStatus: 'partial' | 'paid';
            invoiceNewBalance: number;
          },
        ) => params.invoiceNewBalance,
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
    id: 'paymentRecording',
    initial: 'deciding',
    context: ({ input }) => ({
      ...input,
    }),
    states: {
      // Decide whether to go through Blnk or direct to Invy
      deciding: {
        always: [
          {
            guard: 'isBlnkEnabled',
            target: 'recordingPaymentInBlnk',
          },
          {
            guard: 'isBlnkDisabled',
            target: 'recordingPaymentInInvy',
          },
        ],
      },

      // Record payment in Blnk first (source of truth)
      recordingPaymentInBlnk: {
        invoke: {
          src: 'recordPaymentInBlnk',
          input: ({ context }) => context,
          onDone: {
            target: 'recordingPaymentInInvy',
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
            target: 'failed',
            actions: [
              {
                type: 'storeError',
                params: ({ event }) => ({ error: event.error }),
              },
            ],
          },
        },
      },

      // Record payment in Invy (update invoice)
      recordingPaymentInInvy: {
        invoke: {
          src: 'recordPaymentInInvy',
          input: ({ context }) => context,
          onDone: {
            target: 'completed',
            actions: [
              {
                type: 'storeInvoiceUpdate',
                params: ({ event }) => ({
                  invoiceNewStatus: event.output.invoiceNewStatus,
                  invoiceNewBalance: event.output.invoiceNewBalance,
                }),
              },
            ],
          },
          onError: [
            // If Blnk transaction exists, we need to compensate
            {
              guard: 'hasBlnkTransaction',
              target: 'compensatingBlnk',
              actions: [
                {
                  type: 'storeError',
                  params: ({ event }) => ({ error: event.error }),
                },
              ],
            },
            // No Blnk transaction, just fail
            {
              target: 'failed',
              actions: [
                {
                  type: 'storeError',
                  params: ({ event }) => ({ error: event.error }),
                },
              ],
            },
          ],
        },
      },

      // Compensate by voiding Blnk transaction
      compensatingBlnk: {
        invoke: {
          src: 'voidBlnkTransaction',
          input: ({ context }) => context,
          onDone: 'failed',
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
      completed: {
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
 * Payment recording saga state type
 */
export type PaymentRecordingSagaState =
  | 'deciding'
  | 'recordingPaymentInBlnk'
  | 'recordingPaymentInInvy'
  | 'completed'
  | 'compensatingBlnk'
  | 'failed'
  | 'failedWithInconsistency';

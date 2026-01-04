import { setup, fromPromise, assign } from 'xstate';

/**
 * Credit Note Lifecycle State Machine
 *
 * States:
 * - draft: Initial state, credit note can be edited
 * - finalized: User has confirmed, ready to issue
 * - recordingCredit: Recording the credit in Blnk (if enabled)
 * - issued: Credit note has been issued
 * - applying: Applying credit to an invoice
 * - applied: Credit fully applied (terminal state)
 * - voiding: Voiding the credit note
 * - voided: Credit note voided (terminal state)
 * - failed: Operation failed
 * - failedWithInconsistency: Critical failure requiring manual intervention
 *
 * Events:
 * - FINALIZE: Confirm the credit note is ready to issue
 * - ISSUE: Issue the credit note
 * - APPLY: Apply credit to an invoice
 * - VOID: Void the credit note
 */

export interface CreditNoteContext {
  // Credit note identification
  creditNoteId: string;
  companyId: string;
  clientId: string;
  invoiceId: string; // Original invoice this credit is against
  creditNoteNumber: string;

  // Financial data
  total: number;
  currency: string;
  amountApplied: number;
  balance: number;

  // Blnk integration
  blnkEnabled: boolean;
  blnkTransactionId?: string;

  // Workflow metadata
  correlationId: string;

  // Error tracking
  error?: string;

  // Void reason
  voidReason?: string;
}

export type CreditNoteEvent =
  | { type: 'FINALIZE' }
  | { type: 'ISSUE' }
  | { type: 'APPLY'; targetInvoiceId: string; amount: number }
  | { type: 'VOID'; reason?: string };

export interface CreditNoteMachineActors {
  recordCreditInBlnk: (
    input: CreditNoteContext,
  ) => Promise<{ blnkTransactionId: string }>;
  applyCreditToInvoice: (
    input: CreditNoteContext & {
      targetInvoiceId: string;
      applyAmount: number;
    },
  ) => Promise<{ newBalance: number }>;
  voidCreditInBlnk: (input: CreditNoteContext) => Promise<void>;
  updateCreditNoteStatus: (
    input: CreditNoteContext & { newStatus: string },
  ) => Promise<void>;
}

/**
 * Create the credit note state machine with injected actors
 */
export function createCreditNoteMachine(
  actors: Partial<CreditNoteMachineActors> = {},
) {
  // Default no-op actors for standalone mode
  const defaultActors: CreditNoteMachineActors = {
    recordCreditInBlnk: () => Promise.resolve({ blnkTransactionId: '' }),
    applyCreditToInvoice: () => Promise.resolve({ newBalance: 0 }),
    voidCreditInBlnk: () => Promise.resolve(),
    updateCreditNoteStatus: () => Promise.resolve(),
    ...actors,
  };

  return setup({
    types: {
      context: {} as CreditNoteContext,
      input: {} as CreditNoteContext,
      events: {} as CreditNoteEvent,
    },
    actors: {
      recordCreditInBlnk: fromPromise<
        { blnkTransactionId: string },
        CreditNoteContext
      >(async ({ input }) => defaultActors.recordCreditInBlnk(input)),

      applyCreditToInvoice: fromPromise<
        { newBalance: number },
        CreditNoteContext & { targetInvoiceId: string; applyAmount: number }
      >(async ({ input }) => defaultActors.applyCreditToInvoice(input)),

      voidCreditInBlnk: fromPromise<void, CreditNoteContext>(
        async ({ input }) => defaultActors.voidCreditInBlnk(input),
      ),

      updateCreditNoteStatus: fromPromise<
        void,
        CreditNoteContext & { newStatus: string }
      >(async ({ input }) => defaultActors.updateCreditNoteStatus(input)),
    },
    guards: {
      isBlnkEnabled: ({ context }) => context.blnkEnabled,
      isBlnkDisabled: ({ context }) => !context.blnkEnabled,
      hasBlnkTransaction: ({ context }) => !!context.blnkTransactionId,
      hasRemainingBalance: ({ context }) => context.balance > 0,
      isFullyApplied: ({ context }) => context.balance <= 0,
      canApply: ({ context, event }) => {
        if (event.type !== 'APPLY') return false;
        return event.amount <= context.balance;
      },
    },
    actions: {
      storeBlnkTransactionId: assign({
        blnkTransactionId: (_, params: { blnkTransactionId: string }) =>
          params.blnkTransactionId,
      }),
      updateBalance: assign({
        amountApplied: ({ context }, params: { appliedAmount: number }) =>
          context.amountApplied + params.appliedAmount,
        balance: ({ context }, params: { appliedAmount: number }) =>
          Math.max(0, context.balance - params.appliedAmount),
      }),
      storeVoidReason: assign({
        voidReason: ({ event }) => {
          if (event.type !== 'VOID') return undefined;
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
    id: 'creditNote',
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
          VOID: {
            target: 'voided',
            actions: ['storeVoidReason'],
          },
        },
      },

      // Confirmed, ready to issue
      finalized: {
        on: {
          ISSUE: [
            {
              guard: 'isBlnkEnabled',
              target: 'recordingCredit',
            },
            {
              guard: 'isBlnkDisabled',
              target: 'issued',
            },
          ],
          VOID: {
            target: 'voided',
            actions: ['storeVoidReason'],
          },
        },
      },

      // Recording credit in Blnk
      recordingCredit: {
        invoke: {
          src: 'recordCreditInBlnk',
          input: ({ context }) => context,
          onDone: {
            target: 'issued',
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

      // Credit note issued
      issued: {
        on: {
          APPLY: {
            guard: 'canApply',
            target: 'applying',
          },
          VOID: [
            {
              guard: 'hasBlnkTransaction',
              target: 'voiding',
              actions: ['storeVoidReason'],
            },
            {
              target: 'voided',
              actions: ['storeVoidReason'],
            },
          ],
        },
      },

      // Applying credit to invoice
      applying: {
        invoke: {
          src: 'applyCreditToInvoice',
          input: ({ context, event }) => {
            if (event.type !== 'APPLY') {
              return {
                ...context,
                targetInvoiceId: '',
                applyAmount: 0,
              };
            }
            return {
              ...context,
              targetInvoiceId: event.targetInvoiceId,
              applyAmount: event.amount,
            };
          },
          onDone: [
            {
              // Check if fully applied after this application
              guard: ({ context, event }) => {
                const newBalance =
                  context.balance - (event.output.newBalance ?? 0);
                return newBalance <= 0;
              },
              target: 'applied',
              actions: [
                {
                  type: 'updateBalance',
                  params: ({ event }) => ({
                    appliedAmount: event.output.newBalance ?? 0,
                  }),
                },
              ],
            },
            {
              // Still has remaining balance
              target: 'issued',
              actions: [
                {
                  type: 'updateBalance',
                  params: ({ event }) => ({
                    appliedAmount: event.output.newBalance ?? 0,
                  }),
                },
              ],
            },
          ],
          onError: {
            target: 'issued',
            actions: [
              {
                type: 'storeError',
                params: ({ event }) => ({ error: event.error }),
              },
            ],
          },
        },
      },

      // Voiding the credit note (with Blnk compensation if needed)
      voiding: {
        invoke: {
          src: 'voidCreditInBlnk',
          input: ({ context }) => context,
          onDone: {
            target: 'voided',
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
      applied: {
        type: 'final',
      },

      voided: {
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
 * Credit note machine state type
 */
export type CreditNoteMachineState =
  | 'draft'
  | 'finalized'
  | 'recordingCredit'
  | 'issued'
  | 'applying'
  | 'applied'
  | 'voiding'
  | 'voided'
  | 'failed'
  | 'failedWithInconsistency';

/**
 * Map machine states to database statuses
 */
export function mapCreditNoteMachineStateToDbStatus(
  machineState: CreditNoteMachineState,
): string {
  const mapping: Record<CreditNoteMachineState, string> = {
    draft: 'draft',
    finalized: 'draft', // Still draft in DB until issued
    recordingCredit: 'draft', // Transient state
    issued: 'issued',
    applying: 'issued', // Transient state
    applied: 'applied',
    voiding: 'voided', // Transient state
    voided: 'voided',
    failed: 'voided',
    failedWithInconsistency: 'voided',
  };
  return mapping[machineState] ?? 'draft';
}

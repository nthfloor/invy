import { setup, fromPromise, assign } from 'xstate';

/**
 * Quote/Estimate Lifecycle State Machine
 *
 * States:
 * - draft: Initial state, quote can be edited
 * - finalized: User has confirmed the quote, ready to send
 * - sent: Quote has been sent to client
 * - viewed: Client has viewed the quote
 * - accepted: Client accepted the quote
 * - converting: Converting quote to invoice
 * - converted: Successfully converted to invoice (terminal state)
 * - rejected: Client rejected the quote (terminal state)
 * - expired: Quote expired (terminal state)
 * - failed: Conversion failed (terminal state)
 *
 * Events:
 * - FINALIZE: Confirm the quote is ready to send
 * - SEND: Send the quote to the client
 * - VIEW: Client viewed the quote
 * - ACCEPT: Client accepted the quote
 * - REJECT: Client rejected the quote
 * - EXPIRE: Quote has expired (automated or manual)
 * - CONVERT: Convert accepted quote to invoice
 */

export interface QuoteContext {
  // Quote identification
  quoteId: string;
  companyId: string;
  clientId: string;
  quoteNumber: string;

  // Document type
  documentType: 'quote' | 'estimate';
  isFixedPrice: boolean;

  // Financial data
  total: number;
  currency: string;

  // Dates
  issueDate: Date;
  expiryDate: Date;

  // Conversion data
  convertedInvoiceId?: string;

  // Workflow metadata
  correlationId: string;

  // Error tracking
  error?: string;

  // Rejection reason
  rejectReason?: string;
}

export type QuoteEvent =
  | { type: 'FINALIZE' }
  | { type: 'SEND' }
  | { type: 'VIEW' }
  | { type: 'ACCEPT' }
  | { type: 'REJECT'; reason?: string }
  | { type: 'EXPIRE' }
  | {
      type: 'CONVERT';
      adjustedItems?: AdjustedItem[];
      additionalItems?: NewItem[];
    };

export interface AdjustedItem {
  quoteItemId: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
}

export interface NewItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  productId?: string;
}

export interface QuoteMachineActors {
  convertToInvoice: (input: {
    context: QuoteContext;
    adjustedItems?: AdjustedItem[];
    additionalItems?: NewItem[];
  }) => Promise<{ invoiceId: string }>;
  updateQuoteStatus: (
    input: QuoteContext & { newStatus: string },
  ) => Promise<void>;
}

/**
 * Create the quote state machine with injected actors
 */
export function createQuoteMachine(actors: Partial<QuoteMachineActors> = {}) {
  // Default no-op actors
  const defaultActors: QuoteMachineActors = {
    convertToInvoice: () => Promise.resolve({ invoiceId: '' }),
    updateQuoteStatus: () => Promise.resolve(),
    ...actors,
  };

  return setup({
    types: {
      context: {} as QuoteContext,
      input: {} as QuoteContext,
      events: {} as QuoteEvent,
    },
    actors: {
      convertToInvoice: fromPromise<
        { invoiceId: string },
        {
          context: QuoteContext;
          adjustedItems?: AdjustedItem[];
          additionalItems?: NewItem[];
        }
      >(async ({ input }) => defaultActors.convertToInvoice(input)),

      updateQuoteStatus: fromPromise<
        void,
        QuoteContext & { newStatus: string }
      >(async ({ input }) => defaultActors.updateQuoteStatus(input)),
    },
    guards: {
      isQuote: ({ context }) => context.documentType === 'quote',
      isEstimate: ({ context }) => context.documentType === 'estimate',
      isExpired: ({ context }) => {
        const now = new Date();
        return new Date(context.expiryDate) < now;
      },
      isNotExpired: ({ context }) => {
        const now = new Date();
        return new Date(context.expiryDate) >= now;
      },
    },
    actions: {
      storeConvertedInvoiceId: assign({
        convertedInvoiceId: (_, params: { invoiceId: string }) =>
          params.invoiceId,
      }),
      storeRejectReason: assign({
        rejectReason: ({ event }) => {
          if (event.type !== 'REJECT') return undefined;
          return event.reason;
        },
      }),
      storeError: assign({
        error: (_, params: { error: unknown }) => {
          if (params.error instanceof Error) return params.error.message;
          return String(params.error);
        },
      }),
    },
  }).createMachine({
    id: 'quote',
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
          REJECT: {
            target: 'rejected',
            actions: ['storeRejectReason'],
          },
        },
      },

      // Confirmed, ready to send
      finalized: {
        on: {
          SEND: {
            target: 'sent',
          },
          REJECT: {
            target: 'rejected',
            actions: ['storeRejectReason'],
          },
        },
      },

      // Sent to client
      sent: {
        always: [
          // Automatically expire if past expiry date
          {
            guard: 'isExpired',
            target: 'expired',
          },
        ],
        on: {
          VIEW: {
            target: 'viewed',
          },
          ACCEPT: {
            guard: 'isNotExpired',
            target: 'accepted',
          },
          REJECT: {
            target: 'rejected',
            actions: ['storeRejectReason'],
          },
          EXPIRE: {
            target: 'expired',
          },
        },
      },

      // Client has viewed the quote
      viewed: {
        always: [
          // Automatically expire if past expiry date
          {
            guard: 'isExpired',
            target: 'expired',
          },
        ],
        on: {
          ACCEPT: {
            guard: 'isNotExpired',
            target: 'accepted',
          },
          REJECT: {
            target: 'rejected',
            actions: ['storeRejectReason'],
          },
          EXPIRE: {
            target: 'expired',
          },
        },
      },

      // Client accepted the quote
      accepted: {
        on: {
          CONVERT: {
            target: 'converting',
          },
        },
      },

      // Converting to invoice
      converting: {
        invoke: {
          src: 'convertToInvoice',
          input: ({ context, event }) => {
            if (event.type !== 'CONVERT') {
              return { context };
            }
            return {
              context,
              adjustedItems: event.adjustedItems,
              additionalItems: event.additionalItems,
            };
          },
          onDone: {
            target: 'converted',
            actions: [
              {
                type: 'storeConvertedInvoiceId',
                params: ({ event }) => ({ invoiceId: event.output.invoiceId }),
              },
            ],
          },
          onError: {
            target: 'accepted', // Go back to accepted on failure
            actions: [
              {
                type: 'storeError',
                params: ({ event }) => ({ error: event.error }),
              },
            ],
          },
        },
      },

      // Terminal states
      converted: {
        type: 'final',
      },

      rejected: {
        type: 'final',
      },

      expired: {
        type: 'final',
      },

      failed: {
        type: 'final',
      },
    },
  });
}

/**
 * Quote status type derived from the machine states
 */
export type QuoteMachineState =
  | 'draft'
  | 'finalized'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'converting'
  | 'converted'
  | 'rejected'
  | 'expired'
  | 'failed';

/**
 * Map machine states to database statuses
 */
export function mapQuoteMachineStateToDbStatus(
  machineState: QuoteMachineState,
): string {
  const mapping: Record<QuoteMachineState, string> = {
    draft: 'draft',
    finalized: 'draft', // Still draft in DB until sent
    sent: 'sent',
    viewed: 'viewed',
    accepted: 'accepted',
    converting: 'accepted', // Transient state
    converted: 'converted',
    rejected: 'rejected',
    expired: 'expired',
    failed: 'rejected',
  };
  return mapping[machineState] ?? 'draft';
}

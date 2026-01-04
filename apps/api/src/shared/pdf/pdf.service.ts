import { Injectable, Logger } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type {
  TDocumentDefinitions,
  TFontDictionary,
  Content,
  TableCell,
} from 'pdfmake/interfaces';
import { InvoiceEntity } from '../../invoice/invoice.entity';
import { QuoteEntity } from '../../quote/quote.entity';
import { CreditNoteEntity } from '../../credit-note/credit-note.entity';
import { CompanyEntity, CompanyAddress } from '../../company/company.entity';
import { ClientEntity, ClientAddress } from '../../client/client.entity';
import { ClientStatementDto, InvoiceStatementDto } from '../../statement/dto';

// Define fonts - using built-in Roboto
const fonts: TFontDictionary = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
    bold: 'node_modules/pdfmake/build/vfs_fonts.js',
    italics: 'node_modules/pdfmake/build/vfs_fonts.js',
    bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
};

export interface PdfGenerationOptions {
  download?: boolean;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private printer: PdfPrinter;

  constructor() {
    this.printer = new PdfPrinter(fonts);
  }

  async generateInvoicePdf(
    invoice: InvoiceEntity,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(`Generating PDF for invoice ${invoice.invoiceNumber}`);

    const docDefinition = this.buildInvoiceDocument(invoice, company);
    return this.generatePdfBuffer(docDefinition);
  }

  async generateQuotePdf(
    quote: QuoteEntity,
    company: CompanyEntity,
  ): Promise<Buffer> {
    const documentTypeLabel =
      quote.documentType === 'estimate' ? 'Estimate' : 'Quote';
    this.logger.log(
      `Generating PDF for ${documentTypeLabel.toLowerCase()} ${quote.quoteNumber}`,
    );

    const docDefinition = this.buildQuoteDocument(quote, company);
    return this.generatePdfBuffer(docDefinition);
  }

  async generateCreditNotePdf(
    creditNote: CreditNoteEntity,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating PDF for credit note ${creditNote.creditNoteNumber}`,
    );

    const docDefinition = this.buildCreditNoteDocument(creditNote, company);
    return this.generatePdfBuffer(docDefinition);
  }

  async generateClientStatementPdf(
    statement: ClientStatementDto,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating client statement PDF for ${statement.clientName}`,
    );

    const docDefinition = this.buildClientStatementDocument(statement, company);
    return this.generatePdfBuffer(docDefinition);
  }

  async generateInvoiceStatementPdf(
    statement: InvoiceStatementDto,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating invoice statement PDF for ${statement.invoiceNumber}`,
    );

    const docDefinition = this.buildInvoiceStatementDocument(
      statement,
      company,
    );
    return this.generatePdfBuffer(docDefinition);
  }

  private buildInvoiceDocument(
    invoice: InvoiceEntity,
    company: CompanyEntity,
  ): TDocumentDefinitions {
    const primaryColor = company.branding?.primaryColor || '#2563eb';
    const client = invoice.client;

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.3,
      },
      content: [
        // Header
        this.buildHeader(
          company,
          'INVOICE',
          invoice.invoiceNumber,
          primaryColor,
        ),

        // Invoice Details & Client Info
        {
          columns: [
            this.buildClientInfo(client),
            this.buildInvoiceDetails(invoice),
          ],
          margin: [0, 20, 0, 20] as [number, number, number, number],
        },

        // Line Items Table
        this.buildLineItemsTable(
          invoice.items || [],
          company.currency,
          primaryColor,
        ),

        // Totals
        this.buildTotals(
          {
            subtotal: Number(invoice.subtotal),
            taxTotal: Number(invoice.taxTotal),
            total: Number(invoice.total),
            amountPaid: Number(invoice.amountPaid),
            balance: Number(invoice.balance),
          },
          company.currency,
          true, // Show balance for invoices
        ),

        // Notes & Terms
        ...this.buildNotesAndTerms(invoice.notes, invoice.terms),

        // Footer
        this.buildFooter(company),
      ],
    };
  }

  private buildQuoteDocument(
    quote: QuoteEntity,
    company: CompanyEntity,
  ): TDocumentDefinitions {
    const primaryColor = company.branding?.primaryColor || '#2563eb';
    const client = quote.client;
    const documentTypeLabel =
      quote.documentType === 'estimate' ? 'ESTIMATE' : 'QUOTE';

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.3,
      },
      content: [
        // Header
        this.buildHeader(
          company,
          documentTypeLabel,
          quote.quoteNumber,
          primaryColor,
        ),

        // Quote Details & Client Info
        {
          columns: [
            this.buildClientInfo(client),
            this.buildQuoteDetails(quote),
          ],
          margin: [0, 20, 0, 20] as [number, number, number, number],
        },

        // Pricing note for estimates
        ...(quote.documentType === 'estimate'
          ? [
              {
                text: 'Note: This is an estimate. Final amounts may vary based on actual work performed.',
                style: 'estimateNote',
                margin: [0, 0, 0, 15] as [number, number, number, number],
                italics: true,
                color: '#666666',
              } as Content,
            ]
          : []),

        // Line Items Table
        this.buildLineItemsTable(
          quote.items || [],
          company.currency,
          primaryColor,
        ),

        // Totals
        this.buildTotals(
          {
            subtotal: Number(quote.subtotal),
            taxTotal: Number(quote.taxTotal),
            total: Number(quote.total),
          },
          company.currency,
          false, // No balance for quotes
        ),

        // Notes & Terms
        ...this.buildNotesAndTerms(quote.notes, quote.terms),

        // Validity notice
        {
          text: `This ${quote.documentType} is valid until ${this.formatDate(quote.expiryDate)}`,
          margin: [0, 20, 0, 0] as [number, number, number, number],
          italics: true,
          fontSize: 9,
          color: '#666666',
        },

        // Footer
        this.buildFooter(company),
      ],
    };
  }

  private buildCreditNoteDocument(
    creditNote: CreditNoteEntity,
    company: CompanyEntity,
  ): TDocumentDefinitions {
    const primaryColor = company.branding?.primaryColor || '#dc2626'; // Red for credit notes
    const client = creditNote.client;

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.3,
      },
      content: [
        // Header
        this.buildHeader(
          company,
          'CREDIT NOTE',
          creditNote.creditNoteNumber,
          primaryColor,
        ),

        // Credit Note Details & Client Info
        {
          columns: [
            this.buildClientInfo(client),
            this.buildCreditNoteDetails(creditNote),
          ],
          margin: [0, 20, 0, 20] as [number, number, number, number],
        },

        // Reference to original invoice
        {
          text: `Reference Invoice: ${creditNote.invoice?.invoiceNumber || creditNote.invoiceId}`,
          margin: [0, 0, 0, 10] as [number, number, number, number],
          fontSize: 10,
          color: '#666666',
        },

        // Reason
        {
          stack: [
            {
              text: 'Reason:',
              bold: true,
              margin: [0, 0, 0, 5] as [number, number, number, number],
            },
            { text: creditNote.reason, color: '#666666' },
          ],
          margin: [0, 0, 0, 15] as [number, number, number, number],
        },

        // Line Items Table
        this.buildLineItemsTable(
          creditNote.items || [],
          company.currency,
          primaryColor,
        ),

        // Totals
        this.buildCreditNoteTotals(
          {
            subtotal: Number(creditNote.subtotal),
            taxTotal: Number(creditNote.taxTotal),
            total: Number(creditNote.total),
            amountApplied: Number(creditNote.amountApplied),
            balance: Number(creditNote.balance),
          },
          company.currency,
        ),

        // Notes
        ...(creditNote.notes
          ? [
              {
                margin: [0, 30, 0, 0] as [number, number, number, number],
                stack: [
                  {
                    text: 'Notes',
                    bold: true,
                    margin: [0, 0, 0, 5] as [number, number, number, number],
                  },
                  { text: creditNote.notes, color: '#666666' },
                ],
              } as Content,
            ]
          : []),

        // Footer
        this.buildFooter(company),
      ],
    };
  }

  private buildCreditNoteDetails(creditNote: CreditNoteEntity): any {
    return {
      width: 'auto',
      alignment: 'right' as const,
      stack: [
        {
          columns: [
            { text: 'Issue Date:', width: 100, alignment: 'right' as const },
            {
              text: this.formatDate(creditNote.issueDate),
              width: 80,
              alignment: 'right' as const,
            },
          ],
        },
        {
          columns: [
            { text: 'Status:', width: 100, alignment: 'right' as const },
            {
              text: creditNote.status.toUpperCase(),
              width: 80,
              alignment: 'right' as const,
              bold: true,
              color: this.getCreditNoteStatusColor(creditNote.status),
            },
          ],
        },
      ],
    };
  }

  private buildCreditNoteTotals(
    totals: {
      subtotal: number;
      taxTotal: number;
      total: number;
      amountApplied: number;
      balance: number;
    },
    currency: string,
  ): Content {
    const rows: Content[] = [
      {
        columns: [
          { text: '', width: '*' },
          { text: 'Subtotal:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.subtotal, currency),
            width: 100,
            alignment: 'right' as const,
          },
        ],
      },
      {
        columns: [
          { text: '', width: '*' },
          { text: 'Tax:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.taxTotal, currency),
            width: 100,
            alignment: 'right' as const,
          },
        ],
      },
      {
        columns: [
          { text: '', width: '*' },
          {
            text: 'Credit Total:',
            width: 100,
            alignment: 'right' as const,
            bold: true,
            fontSize: 12,
          },
          {
            text: this.formatCurrency(totals.total, currency),
            width: 100,
            alignment: 'right' as const,
            bold: true,
            fontSize: 12,
            color: '#dc2626',
          },
        ],
      },
    ];

    if (totals.amountApplied > 0) {
      rows.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Applied:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.amountApplied, currency),
            width: 100,
            alignment: 'right' as const,
            color: '#22c55e',
          },
        ],
      });

      rows.push({
        columns: [
          { text: '', width: '*' },
          {
            text: 'Remaining Credit:',
            width: 100,
            alignment: 'right' as const,
            bold: true,
          },
          {
            text: this.formatCurrency(totals.balance, currency),
            width: 100,
            alignment: 'right' as const,
            bold: true,
            color: totals.balance > 0 ? '#dc2626' : '#22c55e',
          },
        ],
      });
    }

    return {
      margin: [0, 20, 0, 0] as [number, number, number, number],
      stack: rows,
    };
  }

  private getCreditNoteStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: '#6b7280',
      issued: '#3b82f6',
      applied: '#22c55e',
      voided: '#6b7280',
    };
    return colors[status] || '#000000';
  }

  private buildClientStatementDocument(
    statement: ClientStatementDto,
    company: CompanyEntity,
  ): TDocumentDefinitions {
    const primaryColor = company.branding?.primaryColor || '#2563eb';

    // Build line items table
    const tableBody: TableCell[][] = [
      [
        {
          text: 'Date',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Type',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Reference',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Description',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Debit',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Credit',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Balance',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
      ],
    ];

    for (const item of statement.lineItems) {
      tableBody.push([
        { text: this.formatDate(item.date) },
        { text: item.type.replace('_', ' ').toUpperCase() },
        { text: item.reference },
        { text: item.description },
        {
          text: item.debit
            ? this.formatCurrency(item.debit, company.currency)
            : '',
          alignment: 'right',
        },
        {
          text: item.credit
            ? this.formatCurrency(item.credit, company.currency)
            : '',
          alignment: 'right',
        },
        {
          text: this.formatCurrency(item.balance, company.currency),
          alignment: 'right',
          bold: true,
        },
      ]);
    }

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 9,
        lineHeight: 1.3,
      },
      content: [
        // Header
        this.buildHeader(company, 'STATEMENT', '', primaryColor),

        // Client Info & Period
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: 'Statement For:',
                  bold: true,
                  margin: [0, 0, 0, 5] as [number, number, number, number],
                },
                { text: statement.clientName, bold: true },
                ...(statement.clientEmail
                  ? [{ text: statement.clientEmail, color: '#666666' }]
                  : []),
              ],
            },
            {
              width: 'auto',
              alignment: 'right' as const,
              stack: [
                {
                  text: `Period: ${this.formatDate(statement.periodStart)} - ${this.formatDate(statement.periodEnd)}`,
                },
                {
                  text: `Opening Balance: ${this.formatCurrency(statement.openingBalance, company.currency)}`,
                  margin: [0, 5, 0, 0] as [number, number, number, number],
                },
              ],
            },
          ],
          margin: [0, 20, 0, 20] as [number, number, number, number],
        },

        // Transactions table
        {
          table: {
            headerRows: 1,
            widths: [60, 50, 60, '*', 70, 70, 70],
            body: tableBody,
          },
          layout: {
            hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
              i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#dddddd',
            paddingTop: () => 6,
            paddingBottom: () => 6,
            paddingLeft: () => 6,
            paddingRight: () => 6,
          },
        },

        // Summary
        {
          margin: [0, 20, 0, 0] as [number, number, number, number],
          stack: [
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Total Invoiced:',
                  width: 120,
                  alignment: 'right' as const,
                },
                {
                  text: this.formatCurrency(
                    statement.totalInvoiced,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                },
              ],
            },
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Total Payments:',
                  width: 120,
                  alignment: 'right' as const,
                },
                {
                  text: this.formatCurrency(
                    statement.totalPayments,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                  color: '#22c55e',
                },
              ],
            },
            ...(statement.totalCredits > 0
              ? [
                  {
                    columns: [
                      { text: '', width: '*' },
                      {
                        text: 'Total Credits:',
                        width: 120,
                        alignment: 'right' as const,
                      },
                      {
                        text: this.formatCurrency(
                          statement.totalCredits,
                          company.currency,
                        ),
                        width: 100,
                        alignment: 'right' as const,
                        color: '#22c55e',
                      },
                    ],
                  },
                ]
              : []),
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Closing Balance:',
                  width: 120,
                  alignment: 'right' as const,
                  bold: true,
                  fontSize: 11,
                },
                {
                  text: this.formatCurrency(
                    statement.closingBalance,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                  bold: true,
                  fontSize: 11,
                  color: statement.closingBalance > 0 ? '#dc2626' : '#22c55e',
                },
              ],
            },
          ],
        },

        // Footer
        this.buildFooter(company),
      ],
    };
  }

  private buildInvoiceStatementDocument(
    statement: InvoiceStatementDto,
    company: CompanyEntity,
  ): TDocumentDefinitions {
    const primaryColor = company.branding?.primaryColor || '#2563eb';

    // Build line items table
    const itemsTableBody: TableCell[][] = [
      [
        {
          text: 'Description',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Line Total',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Paid',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Remaining',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Status',
          style: 'tableHeader',
          alignment: 'center',
          fillColor: primaryColor,
          color: 'white',
        },
      ],
    ];

    for (const item of statement.lineItems) {
      itemsTableBody.push([
        { text: item.description },
        {
          text: this.formatCurrency(item.lineTotal, company.currency),
          alignment: 'right',
        },
        {
          text: this.formatCurrency(item.amountPaid, company.currency),
          alignment: 'right',
          color: '#22c55e',
        },
        {
          text: this.formatCurrency(item.amountRemaining, company.currency),
          alignment: 'right',
          color: item.amountRemaining > 0 ? '#dc2626' : '#22c55e',
        },
        {
          text: item.isPaid ? 'PAID' : 'PARTIAL',
          alignment: 'center',
          color: item.isPaid ? '#22c55e' : '#f59e0b',
          bold: true,
        },
      ]);
    }

    // Build payments table
    const paymentsTableBody: TableCell[][] = [
      [
        {
          text: 'Date',
          style: 'tableHeader',
          fillColor: '#6b7280',
          color: 'white',
        },
        {
          text: 'Reference',
          style: 'tableHeader',
          fillColor: '#6b7280',
          color: 'white',
        },
        {
          text: 'Method',
          style: 'tableHeader',
          fillColor: '#6b7280',
          color: 'white',
        },
        {
          text: 'Amount',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: '#6b7280',
          color: 'white',
        },
      ],
    ];

    for (const payment of statement.payments) {
      paymentsTableBody.push([
        { text: this.formatDate(payment.paymentDate) },
        {
          text: `${payment.paymentNumber}${payment.reference ? ` (${payment.reference})` : ''}`,
        },
        { text: payment.paymentMethod.replace('_', ' ').toUpperCase() },
        {
          text: this.formatCurrency(payment.amount, company.currency),
          alignment: 'right',
        },
      ]);
    }

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        fontSize: 10,
        lineHeight: 1.3,
      },
      content: [
        // Header
        this.buildHeader(
          company,
          'INVOICE STATEMENT',
          statement.invoiceNumber,
          primaryColor,
        ),

        // Invoice Info
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: 'Client:',
                  bold: true,
                  margin: [0, 0, 0, 5] as [number, number, number, number],
                },
                { text: statement.clientName, bold: true },
              ],
            },
            {
              width: 'auto',
              alignment: 'right' as const,
              stack: [
                {
                  text: `Invoice Date: ${this.formatDate(statement.invoiceDate)}`,
                },
                { text: `Due Date: ${this.formatDate(statement.dueDate)}` },
                {
                  text: `Status: ${statement.status.toUpperCase()}`,
                  bold: true,
                  color: this.getStatusColor(statement.status),
                },
              ],
            },
          ],
          margin: [0, 20, 0, 20] as [number, number, number, number],
        },

        // Line Items Section
        {
          text: 'Line Items',
          bold: true,
          fontSize: 12,
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 80, 80, 60],
            body: itemsTableBody,
          },
          layout: {
            hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
              i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#dddddd',
            paddingTop: () => 8,
            paddingBottom: () => 8,
            paddingLeft: () => 8,
            paddingRight: () => 8,
          },
        },

        // Payments Section
        {
          text: 'Payments',
          bold: true,
          fontSize: 12,
          margin: [0, 25, 0, 10] as [number, number, number, number],
        },
        statement.payments.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: [80, '*', 100, 100],
                body: paymentsTableBody,
              },
              layout: {
                hLineWidth: (
                  i: number,
                  node: { table: { body: unknown[] } },
                ) =>
                  i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#dddddd',
                paddingTop: () => 8,
                paddingBottom: () => 8,
                paddingLeft: () => 8,
                paddingRight: () => 8,
              },
            }
          : { text: 'No payments recorded', italics: true, color: '#666666' },

        // Summary
        {
          margin: [0, 25, 0, 0] as [number, number, number, number],
          stack: [
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Invoice Total:',
                  width: 100,
                  alignment: 'right' as const,
                },
                {
                  text: this.formatCurrency(
                    statement.invoiceTotal,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                },
              ],
            },
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Total Paid:',
                  width: 100,
                  alignment: 'right' as const,
                },
                {
                  text: this.formatCurrency(
                    statement.totalPaid,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                  color: '#22c55e',
                },
              ],
            },
            {
              columns: [
                { text: '', width: '*' },
                {
                  text: 'Balance Due:',
                  width: 100,
                  alignment: 'right' as const,
                  bold: true,
                  fontSize: 12,
                },
                {
                  text: this.formatCurrency(
                    statement.balance,
                    company.currency,
                  ),
                  width: 100,
                  alignment: 'right' as const,
                  bold: true,
                  fontSize: 12,
                  color: statement.balance > 0 ? '#dc2626' : '#22c55e',
                },
              ],
            },
          ],
        },

        // Footer
        this.buildFooter(company),
      ],
    };
  }

  private buildHeader(
    company: CompanyEntity,
    documentType: string,
    documentNumber: string,
    primaryColor: string,
  ): Content {
    return {
      columns: [
        // Company Info
        {
          width: '*',
          stack: [
            {
              text: company.name,
              fontSize: 18,
              bold: true,
              color: primaryColor,
            },
            ...(company.address ? this.formatAddress(company.address) : []),
            ...(company.taxId
              ? [
                  {
                    text: `Tax ID: ${company.taxId}`,
                    margin: [0, 5, 0, 0] as [number, number, number, number],
                  },
                ]
              : []),
          ],
        },
        // Document Type & Number
        {
          width: 'auto',
          stack: [
            {
              text: documentType,
              fontSize: 24,
              bold: true,
              color: primaryColor,
              alignment: 'right' as const,
            },
            {
              text: documentNumber,
              fontSize: 12,
              alignment: 'right' as const,
              margin: [0, 5, 0, 0] as [number, number, number, number],
            },
          ],
        },
      ],
    };
  }

  private buildClientInfo(client?: ClientEntity): any {
    if (!client) {
      return { text: '', width: '*' };
    }

    return {
      width: '*',
      stack: [
        {
          text: 'Bill To:',
          bold: true,
          margin: [0, 0, 0, 5] as [number, number, number, number],
        },
        { text: client.name, bold: true },
        ...(client.address ? this.formatAddress(client.address) : []),
        { text: client.email, color: '#666666' },
        ...(client.phone ? [{ text: client.phone, color: '#666666' }] : []),
      ],
    };
  }

  private buildInvoiceDetails(invoice: InvoiceEntity): any {
    return {
      width: 'auto',
      alignment: 'right' as const,
      stack: [
        {
          columns: [
            { text: 'Issue Date:', width: 80, alignment: 'right' as const },
            {
              text: this.formatDate(invoice.issueDate),
              width: 80,
              alignment: 'right' as const,
            },
          ],
        },
        {
          columns: [
            { text: 'Due Date:', width: 80, alignment: 'right' as const },
            {
              text: this.formatDate(invoice.dueDate),
              width: 80,
              alignment: 'right' as const,
              bold: true,
            },
          ],
        },
        {
          columns: [
            { text: 'Status:', width: 80, alignment: 'right' as const },
            {
              text: invoice.status.toUpperCase(),
              width: 80,
              alignment: 'right' as const,
              bold: true,
              color: this.getStatusColor(invoice.status),
            },
          ],
        },
      ],
    };
  }

  private buildQuoteDetails(quote: QuoteEntity): any {
    return {
      width: 'auto',
      alignment: 'right' as const,
      stack: [
        {
          columns: [
            { text: 'Issue Date:', width: 80, alignment: 'right' as const },
            {
              text: this.formatDate(quote.issueDate),
              width: 80,
              alignment: 'right' as const,
            },
          ],
        },
        {
          columns: [
            { text: 'Valid Until:', width: 80, alignment: 'right' as const },
            {
              text: this.formatDate(quote.expiryDate),
              width: 80,
              alignment: 'right' as const,
              bold: true,
            },
          ],
        },
        {
          columns: [
            { text: 'Status:', width: 80, alignment: 'right' as const },
            {
              text: quote.status.toUpperCase(),
              width: 80,
              alignment: 'right' as const,
              bold: true,
              color: this.getQuoteStatusColor(quote.status),
            },
          ],
        },
      ],
    };
  }

  private buildLineItemsTable(
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      lineTotal: number;
    }>,
    currency: string,
    primaryColor: string,
  ): Content {
    const tableBody: TableCell[][] = [
      // Header row
      [
        {
          text: 'Description',
          style: 'tableHeader',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Qty',
          style: 'tableHeader',
          alignment: 'center',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Unit Price',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Tax %',
          style: 'tableHeader',
          alignment: 'center',
          fillColor: primaryColor,
          color: 'white',
        },
        {
          text: 'Amount',
          style: 'tableHeader',
          alignment: 'right',
          fillColor: primaryColor,
          color: 'white',
        },
      ],
    ];

    // Data rows
    items.forEach((item) => {
      tableBody.push([
        { text: item.description },
        { text: Number(item.quantity).toFixed(2), alignment: 'center' },
        {
          text: this.formatCurrency(Number(item.unitPrice), currency),
          alignment: 'right',
        },
        { text: `${Number(item.taxRate).toFixed(1)}%`, alignment: 'center' },
        {
          text: this.formatCurrency(Number(item.lineTotal), currency),
          alignment: 'right',
        },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        widths: ['*', 50, 80, 50, 80],
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => '#dddddd',
        paddingTop: () => 8,
        paddingBottom: () => 8,
        paddingLeft: () => 8,
        paddingRight: () => 8,
      },
    };
  }

  private buildTotals(
    totals: {
      subtotal: number;
      taxTotal: number;
      total: number;
      amountPaid?: number;
      balance?: number;
    },
    currency: string,
    showBalance: boolean,
  ): Content {
    const rows: Content[] = [
      {
        columns: [
          { text: '', width: '*' },
          { text: 'Subtotal:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.subtotal, currency),
            width: 100,
            alignment: 'right' as const,
          },
        ],
      },
      {
        columns: [
          { text: '', width: '*' },
          { text: 'Tax:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.taxTotal, currency),
            width: 100,
            alignment: 'right' as const,
          },
        ],
      },
      {
        columns: [
          { text: '', width: '*' },
          {
            text: 'Total:',
            width: 100,
            alignment: 'right' as const,
            bold: true,
            fontSize: 12,
          },
          {
            text: this.formatCurrency(totals.total, currency),
            width: 100,
            alignment: 'right' as const,
            bold: true,
            fontSize: 12,
          },
        ],
      },
    ];

    if (showBalance && totals.amountPaid !== undefined) {
      rows.push({
        columns: [
          { text: '', width: '*' },
          { text: 'Amount Paid:', width: 100, alignment: 'right' as const },
          {
            text: this.formatCurrency(totals.amountPaid, currency),
            width: 100,
            alignment: 'right' as const,
            color: '#22c55e',
          },
        ],
      });

      if (totals.balance !== undefined) {
        rows.push({
          columns: [
            { text: '', width: '*' },
            {
              text: 'Balance Due:',
              width: 100,
              alignment: 'right' as const,
              bold: true,
              fontSize: 12,
            },
            {
              text: this.formatCurrency(totals.balance, currency),
              width: 100,
              alignment: 'right' as const,
              bold: true,
              fontSize: 12,
              color: totals.balance > 0 ? '#ef4444' : '#22c55e',
            },
          ],
        });
      }
    }

    return {
      margin: [0, 20, 0, 0] as [number, number, number, number],
      stack: rows,
    };
  }

  private buildNotesAndTerms(notes?: string, terms?: string): Content[] {
    const content: Content[] = [];

    if (notes) {
      content.push({
        margin: [0, 30, 0, 0] as [number, number, number, number],
        stack: [
          {
            text: 'Notes',
            bold: true,
            margin: [0, 0, 0, 5] as [number, number, number, number],
          },
          { text: notes, color: '#666666' },
        ],
      });
    }

    if (terms) {
      content.push({
        margin: [0, 15, 0, 0] as [number, number, number, number],
        stack: [
          {
            text: 'Terms & Conditions',
            bold: true,
            margin: [0, 0, 0, 5] as [number, number, number, number],
          },
          { text: terms, color: '#666666', fontSize: 9 },
        ],
      });
    }

    return content;
  }

  private buildFooter(company: CompanyEntity): Content {
    return {
      margin: [0, 40, 0, 0] as [number, number, number, number],
      stack: [
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#dddddd',
            },
          ],
        },
        {
          text: `Thank you for your business with ${company.name}`,
          alignment: 'center' as const,
          margin: [0, 15, 0, 0] as [number, number, number, number],
          fontSize: 10,
          color: '#666666',
        },
      ],
    };
  }

  private formatAddress(address: CompanyAddress | ClientAddress): Content[] {
    const lines: Content[] = [];

    if (address.line1) lines.push({ text: address.line1 });
    if (address.line2) lines.push({ text: address.line2 });

    const cityLine = [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', ');
    if (cityLine) lines.push({ text: cityLine });

    if (address.country) lines.push({ text: address.country });

    return lines;
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount);
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: '#6b7280',
      sent: '#3b82f6',
      viewed: '#8b5cf6',
      partial: '#f59e0b',
      paid: '#22c55e',
      overdue: '#ef4444',
      cancelled: '#6b7280',
    };
    return colors[status] || '#000000';
  }

  private getQuoteStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: '#6b7280',
      sent: '#3b82f6',
      viewed: '#8b5cf6',
      accepted: '#22c55e',
      rejected: '#ef4444',
      expired: '#6b7280',
      converted: '#22c55e',
    };
    return colors[status] || '#000000';
  }

  private generatePdfBuffer(
    docDefinition: TDocumentDefinitions,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on('end', () => {
          const result = Buffer.concat(chunks);
          resolve(result);
        });

        pdfDoc.on('error', (error: Error) => {
          reject(error);
        });

        pdfDoc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

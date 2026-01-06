import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { InvoiceEntity } from '../../invoice/invoice.entity';
import { QuoteEntity } from '../../quote/quote.entity';
import { CreditNoteEntity } from '../../credit-note/credit-note.entity';
import { CompanyEntity, CompanyAddress } from '../../company/company.entity';
import { ClientEntity, ClientAddress } from '../../client/client.entity';
import { ClientStatementDto, InvoiceStatementDto } from '../../statement/dto';
import { DEFAULT_CURRENCY } from '../constants/currencies';

// Page constants
const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Table column widths for line items
const LINE_ITEM_COLS = {
  description: 200,
  qty: 50,
  unitPrice: 80,
  taxRate: 50,
  amount: 80,
};

export interface PdfGenerationOptions {
  download?: boolean;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  // ============================================
  // PUBLIC METHODS
  // ============================================

  async generateInvoicePdf(
    invoice: InvoiceEntity,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(`Generating PDF for invoice ${invoice.invoiceNumber}`);

    return this.generatePdf((doc) => {
      const primaryColor = company.branding?.primaryColor || '#2563eb';

      this.drawHeader(
        doc,
        company,
        'INVOICE',
        invoice.invoiceNumber,
        primaryColor,
      );
      doc.moveDown(2);

      // Two-column layout: Client info (left) and Invoice details (right)
      const startY = doc.y;
      this.drawClientInfo(doc, invoice.client);

      doc.y = startY;
      this.drawInvoiceDetails(doc, invoice);

      doc.y = Math.max(doc.y, startY + 80);
      doc.moveDown(2);

      // Line items table
      this.drawLineItemsTable(
        doc,
        invoice.items || [],
        company.currency,
        primaryColor,
      );
      doc.moveDown();

      // Totals
      this.drawTotals(
        doc,
        {
          subtotal: Number(invoice.subtotal),
          taxTotal: Number(invoice.taxTotal),
          total: Number(invoice.total),
          amountPaid: Number(invoice.amountPaid),
          balance: Number(invoice.balance),
        },
        company.currency,
        true,
      );

      // Notes & Terms
      this.drawNotesAndTerms(doc, invoice.notes, invoice.terms);

      // Footer
      this.drawFooter(doc, company);
    });
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

    return this.generatePdf((doc) => {
      const primaryColor = company.branding?.primaryColor || '#2563eb';
      const headerLabel =
        quote.documentType === 'estimate' ? 'ESTIMATE' : 'QUOTE';

      this.drawHeader(
        doc,
        company,
        headerLabel,
        quote.quoteNumber,
        primaryColor,
      );
      doc.moveDown(2);

      // Two-column layout
      const startY = doc.y;
      this.drawClientInfo(doc, quote.client);

      doc.y = startY;
      this.drawQuoteDetails(doc, quote);

      doc.y = Math.max(doc.y, startY + 80);
      doc.moveDown(2);

      // Estimate note
      if (quote.documentType === 'estimate') {
        doc
          .fontSize(10)
          .fillColor('#666666')
          .font('Helvetica-Oblique')
          .text(
            'Note: This is an estimate. Final amounts may vary based on actual work performed.',
          )
          .font('Helvetica')
          .fillColor('#000000');
        doc.moveDown();
      }

      // Line items table
      this.drawLineItemsTable(
        doc,
        quote.items || [],
        company.currency,
        primaryColor,
      );
      doc.moveDown();

      // Totals
      this.drawTotals(
        doc,
        {
          subtotal: Number(quote.subtotal),
          taxTotal: Number(quote.taxTotal),
          total: Number(quote.total),
        },
        company.currency,
        false,
      );

      // Notes & Terms
      this.drawNotesAndTerms(doc, quote.notes, quote.terms);

      // Validity notice
      doc.moveDown(2);
      doc
        .fontSize(9)
        .fillColor('#666666')
        .font('Helvetica-Oblique')
        .text(
          `This ${quote.documentType} is valid until ${this.formatDate(quote.expiryDate)}`,
        )
        .font('Helvetica')
        .fillColor('#000000');

      // Footer
      this.drawFooter(doc, company);
    });
  }

  async generateCreditNotePdf(
    creditNote: CreditNoteEntity,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating PDF for credit note ${creditNote.creditNoteNumber}`,
    );

    return this.generatePdf((doc) => {
      const primaryColor = '#dc2626'; // Red for credit notes

      this.drawHeader(
        doc,
        company,
        'CREDIT NOTE',
        creditNote.creditNoteNumber,
        primaryColor,
      );
      doc.moveDown(2);

      // Two-column layout
      const startY = doc.y;
      this.drawClientInfo(doc, creditNote.client);

      doc.y = startY;
      this.drawCreditNoteDetails(doc, creditNote);

      doc.y = Math.max(doc.y, startY + 80);
      doc.moveDown();

      // Reference invoice
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(
          `Reference Invoice: ${creditNote.invoice?.invoiceNumber || creditNote.invoiceId}`,
        )
        .fillColor('#000000');
      doc.moveDown();

      // Reason
      doc.font('Helvetica-Bold').text('Reason:').font('Helvetica');
      doc.fillColor('#666666').text(creditNote.reason).fillColor('#000000');
      doc.moveDown(2);

      // Line items table
      this.drawLineItemsTable(
        doc,
        creditNote.items || [],
        company.currency,
        primaryColor,
      );
      doc.moveDown();

      // Credit note totals
      this.drawCreditNoteTotals(
        doc,
        {
          subtotal: Number(creditNote.subtotal),
          taxTotal: Number(creditNote.taxTotal),
          total: Number(creditNote.total),
          amountApplied: Number(creditNote.amountApplied),
          balance: Number(creditNote.balance),
        },
        company.currency,
      );

      // Notes
      if (creditNote.notes) {
        doc.moveDown(2);
        doc.font('Helvetica-Bold').text('Notes').font('Helvetica');
        doc.fillColor('#666666').text(creditNote.notes).fillColor('#000000');
      }

      // Footer
      this.drawFooter(doc, company);
    });
  }

  async generateClientStatementPdf(
    statement: ClientStatementDto,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating client statement PDF for ${statement.clientName}`,
    );

    return this.generatePdf((doc) => {
      const primaryColor = company.branding?.primaryColor || '#2563eb';

      this.drawHeader(doc, company, 'STATEMENT', '', primaryColor);
      doc.moveDown(2);

      // Statement info
      const startY = doc.y;
      doc.font('Helvetica-Bold').text('Statement For:').font('Helvetica');
      doc.font('Helvetica-Bold').text(statement.clientName).font('Helvetica');
      if (statement.clientEmail) {
        doc
          .fillColor('#666666')
          .text(statement.clientEmail)
          .fillColor('#000000');
      }

      doc.y = startY;
      doc.x = PAGE_WIDTH - MARGIN - 200;
      doc.text(
        `Period: ${this.formatDate(statement.periodStart)} - ${this.formatDate(statement.periodEnd)}`,
        { align: 'right' },
      );
      doc.text(
        `Opening Balance: ${this.formatCurrency(statement.openingBalance, company.currency)}`,
        { align: 'right' },
      );
      doc.x = MARGIN;

      doc.y = Math.max(doc.y, startY + 60);
      doc.moveDown(2);

      // Statement table
      this.drawStatementTable(
        doc,
        statement.lineItems,
        company.currency,
        primaryColor,
      );
      doc.moveDown(2);

      // Summary
      this.drawStatementSummary(doc, statement, company.currency);

      // Footer
      this.drawFooter(doc, company);
    });
  }

  async generateInvoiceStatementPdf(
    statement: InvoiceStatementDto,
    company: CompanyEntity,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating invoice statement PDF for ${statement.invoiceNumber}`,
    );

    return this.generatePdf((doc) => {
      const primaryColor = company.branding?.primaryColor || '#2563eb';

      this.drawHeader(
        doc,
        company,
        'INVOICE STATEMENT',
        statement.invoiceNumber,
        primaryColor,
      );
      doc.moveDown(2);

      // Invoice info
      const startY = doc.y;
      doc.font('Helvetica-Bold').text('Client:').font('Helvetica');
      doc.font('Helvetica-Bold').text(statement.clientName).font('Helvetica');

      doc.y = startY;
      doc.x = PAGE_WIDTH - MARGIN - 200;
      doc.text(`Invoice Date: ${this.formatDate(statement.invoiceDate)}`, {
        align: 'right',
      });
      doc.text(`Due Date: ${this.formatDate(statement.dueDate)}`, {
        align: 'right',
      });
      doc
        .font('Helvetica-Bold')
        .fillColor(this.getStatusColor(statement.status))
        .text(`Status: ${statement.status.toUpperCase()}`, { align: 'right' })
        .fillColor('#000000')
        .font('Helvetica');
      doc.x = MARGIN;

      doc.y = Math.max(doc.y, startY + 60);
      doc.moveDown(2);

      // Line items section
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Line Items')
        .font('Helvetica')
        .fontSize(10);
      doc.moveDown();
      this.drawInvoiceStatementItemsTable(
        doc,
        statement.lineItems,
        company.currency,
        primaryColor,
      );
      doc.moveDown(2);

      // Payments section
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Payments')
        .font('Helvetica')
        .fontSize(10);
      doc.moveDown();
      if (statement.payments.length > 0) {
        this.drawPaymentsTable(doc, statement.payments, company.currency);
      } else {
        doc
          .font('Helvetica-Oblique')
          .fillColor('#666666')
          .text('No payments recorded')
          .fillColor('#000000')
          .font('Helvetica');
      }
      doc.moveDown(2);

      // Summary
      this.drawInvoiceStatementSummary(doc, statement, company.currency);

      // Footer
      this.drawFooter(doc, company);
    });
  }

  // ============================================
  // PDF GENERATION CORE
  // ============================================

  private generatePdf(
    drawContent: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        });
        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);

        doc.pipe(stream);
        drawContent(doc);
        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  // ============================================
  // HEADER & FOOTER
  // ============================================

  private drawHeader(
    doc: PDFKit.PDFDocument,
    company: CompanyEntity,
    documentType: string,
    documentNumber: string,
    primaryColor: string,
  ): void {
    const startY = doc.y;

    // Company info (left side)
    doc
      .fontSize(18)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(company.name, MARGIN, startY);
    doc.fontSize(10).fillColor('#000000').font('Helvetica');

    if (company.address) {
      this.drawAddress(doc, company.address);
    }
    if (company.taxId) {
      doc.moveDown(0.5);
      doc.text(`Tax ID: ${company.taxId}`);
    }

    const leftColumnBottom = doc.y;

    // Document type & number (right side)
    doc
      .fontSize(24)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(documentType, MARGIN, startY, { align: 'right' });
    doc
      .fontSize(12)
      .fillColor('#000000')
      .font('Helvetica')
      .text(documentNumber, { align: 'right' });

    doc.y = Math.max(leftColumnBottom, doc.y);
  }

  private drawFooter(doc: PDFKit.PDFDocument, company: CompanyEntity): void {
    const footerY = PAGE_HEIGHT - MARGIN - 40;

    // Ensure we're at the footer position
    if (doc.y < footerY - 20) {
      doc.y = footerY;
    } else {
      doc.addPage();
      doc.y = footerY;
    }

    // Horizontal line
    doc
      .strokeColor('#dddddd')
      .lineWidth(0.5)
      .moveTo(MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - MARGIN, doc.y)
      .stroke();

    doc.moveDown();
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Thank you for your business with ${company.name}`, {
        align: 'center',
      });
  }

  // ============================================
  // CLIENT & DOCUMENT INFO
  // ============================================

  private drawClientInfo(doc: PDFKit.PDFDocument, client?: ClientEntity): void {
    if (!client) return;

    doc.font('Helvetica-Bold').text('Bill To:').font('Helvetica');
    doc.font('Helvetica-Bold').text(client.name).font('Helvetica');

    if (client.address) {
      this.drawAddress(doc, client.address);
    }

    doc.fillColor('#666666').text(client.email);
    if (client.phone) {
      doc.text(client.phone);
    }
    doc.fillColor('#000000');
  }

  private drawInvoiceDetails(
    doc: PDFKit.PDFDocument,
    invoice: InvoiceEntity,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 160;
    doc.x = rightX;

    this.drawDetailRow(doc, 'Issue Date:', this.formatDate(invoice.issueDate));
    this.drawDetailRow(
      doc,
      'Due Date:',
      this.formatDate(invoice.dueDate),
      true,
    );
    this.drawDetailRow(
      doc,
      'Status:',
      invoice.status.toUpperCase(),
      true,
      this.getStatusColor(invoice.status),
    );

    doc.x = MARGIN;
  }

  private drawQuoteDetails(doc: PDFKit.PDFDocument, quote: QuoteEntity): void {
    const rightX = PAGE_WIDTH - MARGIN - 160;
    doc.x = rightX;

    this.drawDetailRow(doc, 'Issue Date:', this.formatDate(quote.issueDate));
    this.drawDetailRow(
      doc,
      'Valid Until:',
      this.formatDate(quote.expiryDate),
      true,
    );
    this.drawDetailRow(
      doc,
      'Status:',
      quote.status.toUpperCase(),
      true,
      this.getQuoteStatusColor(quote.status),
    );

    doc.x = MARGIN;
  }

  private drawCreditNoteDetails(
    doc: PDFKit.PDFDocument,
    creditNote: CreditNoteEntity,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 160;
    doc.x = rightX;

    this.drawDetailRow(
      doc,
      'Issue Date:',
      this.formatDate(creditNote.issueDate),
    );
    this.drawDetailRow(
      doc,
      'Status:',
      creditNote.status.toUpperCase(),
      true,
      this.getCreditNoteStatusColor(creditNote.status),
    );

    doc.x = MARGIN;
  }

  private drawDetailRow(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    bold = false,
    color = '#000000',
  ): void {
    const y = doc.y;
    doc.text(label, { continued: false });
    doc.y = y;
    doc.x = PAGE_WIDTH - MARGIN - 80;

    if (bold) doc.font('Helvetica-Bold');
    doc.fillColor(color).text(value, { align: 'right' });
    doc.fillColor('#000000').font('Helvetica');

    doc.x = PAGE_WIDTH - MARGIN - 160;
  }

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  private drawLineItemsTable(
    doc: PDFKit.PDFDocument,
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      lineTotal: number;
    }>,
    currency: string,
    primaryColor: string,
  ): void {
    const tableTop = doc.y;
    const rowHeight = 25;

    // Header
    this.drawTableHeader(doc, tableTop, primaryColor);

    // Data rows
    let y = tableTop + rowHeight;
    for (const item of items) {
      // Check for page break
      if (y > PAGE_HEIGHT - MARGIN - 100) {
        doc.addPage();
        y = MARGIN;
        this.drawTableHeader(doc, y, primaryColor);
        y += rowHeight;
      }

      this.drawLineItemRow(doc, y, item, currency);
      y += rowHeight;
    }

    doc.y = y;
  }

  private drawTableHeader(
    doc: PDFKit.PDFDocument,
    y: number,
    primaryColor: string,
  ): void {
    const cols = LINE_ITEM_COLS;
    let x = MARGIN;

    // Background
    doc.rect(x, y, CONTENT_WIDTH, 22).fill(primaryColor);

    // Header text
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');

    doc.text('Description', x + 5, y + 6, { width: cols.description });
    x += cols.description;

    doc.text('Qty', x, y + 6, { width: cols.qty, align: 'center' });
    x += cols.qty;

    doc.text('Unit Price', x, y + 6, { width: cols.unitPrice, align: 'right' });
    x += cols.unitPrice;

    doc.text('Tax %', x, y + 6, { width: cols.taxRate, align: 'center' });
    x += cols.taxRate;

    doc.text('Amount', x, y + 6, { width: cols.amount, align: 'right' });

    doc.fillColor('#000000').font('Helvetica').fontSize(10);
  }

  private drawLineItemRow(
    doc: PDFKit.PDFDocument,
    y: number,
    item: {
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      lineTotal: number;
    },
    currency: string,
  ): void {
    const cols = LINE_ITEM_COLS;
    let x = MARGIN;

    // Bottom border
    doc
      .strokeColor('#dddddd')
      .lineWidth(0.5)
      .moveTo(MARGIN, y + 22)
      .lineTo(PAGE_WIDTH - MARGIN, y + 22)
      .stroke();

    doc.fontSize(9);

    doc.text(item.description, x + 5, y + 6, { width: cols.description });
    x += cols.description;

    doc.text(Number(item.quantity).toFixed(2), x, y + 6, {
      width: cols.qty,
      align: 'center',
    });
    x += cols.qty;

    doc.text(this.formatCurrency(Number(item.unitPrice), currency), x, y + 6, {
      width: cols.unitPrice,
      align: 'right',
    });
    x += cols.unitPrice;

    doc.text(`${Number(item.taxRate).toFixed(1)}%`, x, y + 6, {
      width: cols.taxRate,
      align: 'center',
    });
    x += cols.taxRate;

    doc.text(this.formatCurrency(Number(item.lineTotal), currency), x, y + 6, {
      width: cols.amount,
      align: 'right',
    });

    doc.fontSize(10);
  }

  // ============================================
  // TOTALS
  // ============================================

  private drawTotals(
    doc: PDFKit.PDFDocument,
    totals: {
      subtotal: number;
      taxTotal: number;
      total: number;
      amountPaid?: number;
      balance?: number;
    },
    currency: string,
    showBalance: boolean,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 200;

    this.drawTotalRow(
      doc,
      rightX,
      'Subtotal:',
      this.formatCurrency(totals.subtotal, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Tax:',
      this.formatCurrency(totals.taxTotal, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Total:',
      this.formatCurrency(totals.total, currency),
      true,
      12,
    );

    if (showBalance && totals.amountPaid !== undefined) {
      this.drawTotalRow(
        doc,
        rightX,
        'Amount Paid:',
        this.formatCurrency(totals.amountPaid, currency),
        false,
        10,
        '#22c55e',
      );

      if (totals.balance !== undefined) {
        const balanceColor = totals.balance > 0 ? '#ef4444' : '#22c55e';
        this.drawTotalRow(
          doc,
          rightX,
          'Balance Due:',
          this.formatCurrency(totals.balance, currency),
          true,
          12,
          balanceColor,
        );
      }
    }
  }

  private drawCreditNoteTotals(
    doc: PDFKit.PDFDocument,
    totals: {
      subtotal: number;
      taxTotal: number;
      total: number;
      amountApplied: number;
      balance: number;
    },
    currency: string,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 200;

    this.drawTotalRow(
      doc,
      rightX,
      'Subtotal:',
      this.formatCurrency(totals.subtotal, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Tax:',
      this.formatCurrency(totals.taxTotal, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Credit Total:',
      this.formatCurrency(totals.total, currency),
      true,
      12,
      '#dc2626',
    );

    if (totals.amountApplied > 0) {
      this.drawTotalRow(
        doc,
        rightX,
        'Applied:',
        this.formatCurrency(totals.amountApplied, currency),
        false,
        10,
        '#22c55e',
      );
      const balanceColor = totals.balance > 0 ? '#dc2626' : '#22c55e';
      this.drawTotalRow(
        doc,
        rightX,
        'Remaining Credit:',
        this.formatCurrency(totals.balance, currency),
        true,
        10,
        balanceColor,
      );
    }
  }

  private drawTotalRow(
    doc: PDFKit.PDFDocument,
    x: number,
    label: string,
    value: string,
    bold = false,
    fontSize = 10,
    valueColor = '#000000',
  ): void {
    const y = doc.y;

    doc.fontSize(fontSize);
    if (bold) doc.font('Helvetica-Bold');

    doc.text(label, x, y, { width: 100, align: 'right' });
    doc
      .fillColor(valueColor)
      .text(value, x + 100, y, { width: 100, align: 'right' });

    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.y = y + fontSize + 5;
  }

  // ============================================
  // NOTES & TERMS
  // ============================================

  private drawNotesAndTerms(
    doc: PDFKit.PDFDocument,
    notes?: string,
    terms?: string,
  ): void {
    if (notes) {
      doc.moveDown(2);
      doc.font('Helvetica-Bold').text('Notes').font('Helvetica');
      doc.fillColor('#666666').text(notes).fillColor('#000000');
    }

    if (terms) {
      doc.moveDown();
      doc.font('Helvetica-Bold').text('Terms & Conditions').font('Helvetica');
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text(terms)
        .fillColor('#000000')
        .fontSize(10);
    }
  }

  // ============================================
  // STATEMENT TABLES
  // ============================================

  private drawStatementTable(
    doc: PDFKit.PDFDocument,
    lineItems: ClientStatementDto['lineItems'],
    currency: string,
    primaryColor: string,
  ): void {
    const colWidths = {
      date: 60,
      type: 50,
      ref: 60,
      desc: 130,
      debit: 60,
      credit: 60,
      balance: 70,
    };
    let y = doc.y;

    // Header
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(primaryColor);
    doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold');

    let x = MARGIN + 5;
    doc.text('Date', x, y + 5, { width: colWidths.date });
    x += colWidths.date;
    doc.text('Type', x, y + 5, { width: colWidths.type });
    x += colWidths.type;
    doc.text('Reference', x, y + 5, { width: colWidths.ref });
    x += colWidths.ref;
    doc.text('Description', x, y + 5, { width: colWidths.desc });
    x += colWidths.desc;
    doc.text('Debit', x, y + 5, { width: colWidths.debit, align: 'right' });
    x += colWidths.debit;
    doc.text('Credit', x, y + 5, { width: colWidths.credit, align: 'right' });
    x += colWidths.credit;
    doc.text('Balance', x, y + 5, { width: colWidths.balance, align: 'right' });

    doc.fillColor('#000000').font('Helvetica');
    y += 22;

    // Rows
    for (const item of lineItems) {
      if (y > PAGE_HEIGHT - MARGIN - 60) {
        doc.addPage();
        y = MARGIN;
      }

      doc
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .moveTo(MARGIN, y + 18)
        .lineTo(PAGE_WIDTH - MARGIN, y + 18)
        .stroke();

      x = MARGIN + 5;
      doc.text(this.formatDate(item.date), x, y + 4, { width: colWidths.date });
      x += colWidths.date;
      doc.text(item.type.replace('_', ' ').toUpperCase(), x, y + 4, {
        width: colWidths.type,
      });
      x += colWidths.type;
      doc.text(item.reference, x, y + 4, { width: colWidths.ref });
      x += colWidths.ref;
      doc.text(item.description, x, y + 4, { width: colWidths.desc });
      x += colWidths.desc;
      doc.text(
        item.debit ? this.formatCurrency(item.debit, currency) : '',
        x,
        y + 4,
        { width: colWidths.debit, align: 'right' },
      );
      x += colWidths.debit;
      doc.text(
        item.credit ? this.formatCurrency(item.credit, currency) : '',
        x,
        y + 4,
        { width: colWidths.credit, align: 'right' },
      );
      x += colWidths.credit;
      doc
        .font('Helvetica-Bold')
        .text(this.formatCurrency(item.balance, currency), x, y + 4, {
          width: colWidths.balance,
          align: 'right',
        })
        .font('Helvetica');

      y += 20;
    }

    doc.y = y;
    doc.fontSize(10);
  }

  private drawStatementSummary(
    doc: PDFKit.PDFDocument,
    statement: ClientStatementDto,
    currency: string,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 220;

    this.drawTotalRow(
      doc,
      rightX,
      'Total Invoiced:',
      this.formatCurrency(statement.totalInvoiced, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Total Payments:',
      this.formatCurrency(statement.totalPayments, currency),
      false,
      10,
      '#22c55e',
    );

    if (statement.totalCredits > 0) {
      this.drawTotalRow(
        doc,
        rightX,
        'Total Credits:',
        this.formatCurrency(statement.totalCredits, currency),
        false,
        10,
        '#22c55e',
      );
    }

    const balanceColor = statement.closingBalance > 0 ? '#dc2626' : '#22c55e';
    this.drawTotalRow(
      doc,
      rightX,
      'Closing Balance:',
      this.formatCurrency(statement.closingBalance, currency),
      true,
      11,
      balanceColor,
    );
  }

  private drawInvoiceStatementItemsTable(
    doc: PDFKit.PDFDocument,
    lineItems: InvoiceStatementDto['lineItems'],
    currency: string,
    primaryColor: string,
  ): void {
    const colWidths = {
      desc: 180,
      total: 80,
      paid: 80,
      remaining: 80,
      status: 60,
    };
    let y = doc.y;

    // Header
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(primaryColor);
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');

    let x = MARGIN + 5;
    doc.text('Description', x, y + 5, { width: colWidths.desc });
    x += colWidths.desc;
    doc.text('Line Total', x, y + 5, {
      width: colWidths.total,
      align: 'right',
    });
    x += colWidths.total;
    doc.text('Paid', x, y + 5, { width: colWidths.paid, align: 'right' });
    x += colWidths.paid;
    doc.text('Remaining', x, y + 5, {
      width: colWidths.remaining,
      align: 'right',
    });
    x += colWidths.remaining;
    doc.text('Status', x, y + 5, { width: colWidths.status, align: 'center' });

    doc.fillColor('#000000').font('Helvetica');
    y += 22;

    // Rows
    for (const item of lineItems) {
      doc
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .moveTo(MARGIN, y + 18)
        .lineTo(PAGE_WIDTH - MARGIN, y + 18)
        .stroke();

      x = MARGIN + 5;
      doc.text(item.description, x, y + 4, { width: colWidths.desc });
      x += colWidths.desc;
      doc.text(this.formatCurrency(item.lineTotal, currency), x, y + 4, {
        width: colWidths.total,
        align: 'right',
      });
      x += colWidths.total;
      doc
        .fillColor('#22c55e')
        .text(this.formatCurrency(item.amountPaid, currency), x, y + 4, {
          width: colWidths.paid,
          align: 'right',
        })
        .fillColor('#000000');
      x += colWidths.paid;
      const remainingColor = item.amountRemaining > 0 ? '#dc2626' : '#22c55e';
      doc
        .fillColor(remainingColor)
        .text(this.formatCurrency(item.amountRemaining, currency), x, y + 4, {
          width: colWidths.remaining,
          align: 'right',
        })
        .fillColor('#000000');
      x += colWidths.remaining;
      const statusColor = item.isPaid ? '#22c55e' : '#f59e0b';
      doc
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(item.isPaid ? 'PAID' : 'PARTIAL', x, y + 4, {
          width: colWidths.status,
          align: 'center',
        })
        .fillColor('#000000')
        .font('Helvetica');

      y += 20;
    }

    doc.y = y;
    doc.fontSize(10);
  }

  private drawPaymentsTable(
    doc: PDFKit.PDFDocument,
    payments: InvoiceStatementDto['payments'],
    currency: string,
  ): void {
    const colWidths = { date: 80, ref: 160, method: 100, amount: 100 };
    let y = doc.y;

    // Header
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill('#6b7280');
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');

    let x = MARGIN + 5;
    doc.text('Date', x, y + 5, { width: colWidths.date });
    x += colWidths.date;
    doc.text('Reference', x, y + 5, { width: colWidths.ref });
    x += colWidths.ref;
    doc.text('Method', x, y + 5, { width: colWidths.method });
    x += colWidths.method;
    doc.text('Amount', x, y + 5, { width: colWidths.amount, align: 'right' });

    doc.fillColor('#000000').font('Helvetica');
    y += 22;

    // Rows
    for (const payment of payments) {
      doc
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .moveTo(MARGIN, y + 18)
        .lineTo(PAGE_WIDTH - MARGIN, y + 18)
        .stroke();

      x = MARGIN + 5;
      doc.text(this.formatDate(payment.paymentDate), x, y + 4, {
        width: colWidths.date,
      });
      x += colWidths.date;
      const ref = `${payment.paymentNumber}${payment.reference ? ` (${payment.reference})` : ''}`;
      doc.text(ref, x, y + 4, { width: colWidths.ref });
      x += colWidths.ref;
      doc.text(
        payment.paymentMethod.replace('_', ' ').toUpperCase(),
        x,
        y + 4,
        { width: colWidths.method },
      );
      x += colWidths.method;
      doc.text(this.formatCurrency(payment.amount, currency), x, y + 4, {
        width: colWidths.amount,
        align: 'right',
      });

      y += 20;
    }

    doc.y = y;
    doc.fontSize(10);
  }

  private drawInvoiceStatementSummary(
    doc: PDFKit.PDFDocument,
    statement: InvoiceStatementDto,
    currency: string,
  ): void {
    const rightX = PAGE_WIDTH - MARGIN - 200;

    this.drawTotalRow(
      doc,
      rightX,
      'Invoice Total:',
      this.formatCurrency(statement.invoiceTotal, currency),
    );
    this.drawTotalRow(
      doc,
      rightX,
      'Total Paid:',
      this.formatCurrency(statement.totalPaid, currency),
      false,
      10,
      '#22c55e',
    );

    const balanceColor = statement.balance > 0 ? '#dc2626' : '#22c55e';
    this.drawTotalRow(
      doc,
      rightX,
      'Balance Due:',
      this.formatCurrency(statement.balance, currency),
      true,
      12,
      balanceColor,
    );
  }

  // ============================================
  // FORMATTING HELPERS
  // ============================================

  private drawAddress(
    doc: PDFKit.PDFDocument,
    address: CompanyAddress | ClientAddress,
  ): void {
    if (address.line1) doc.text(address.line1);
    if (address.line2) doc.text(address.line2);

    const cityLine = [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(', ');
    if (cityLine) doc.text(cityLine);

    if (address.country) doc.text(address.country);
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
      currency: currency || DEFAULT_CURRENCY,
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

  private getCreditNoteStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: '#6b7280',
      issued: '#3b82f6',
      applied: '#22c55e',
      voided: '#6b7280',
    };
    return colors[status] || '#000000';
  }
}

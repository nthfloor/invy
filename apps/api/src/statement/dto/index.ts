import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatementLineItemDto {
  @ApiProperty({ description: 'Date of transaction' })
  date!: Date;

  @ApiProperty({
    description: 'Type of transaction',
    enum: ['invoice', 'payment', 'credit_note'],
  })
  type!: 'invoice' | 'payment' | 'credit_note';

  @ApiProperty({ description: 'Reference number' })
  reference!: string;

  @ApiProperty({ description: 'Description' })
  description!: string;

  @ApiPropertyOptional({ description: 'Debit amount (invoice)' })
  debit?: number;

  @ApiPropertyOptional({ description: 'Credit amount (payment/credit note)' })
  credit?: number;

  @ApiProperty({ description: 'Running balance after this transaction' })
  balance!: number;
}

export class ClientStatementDto {
  @ApiProperty({ description: 'Client ID' })
  clientId!: string;

  @ApiProperty({ description: 'Client name' })
  clientName!: string;

  @ApiPropertyOptional({ description: 'Client email' })
  clientEmail?: string;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({ description: 'Company name' })
  companyName!: string;

  @ApiProperty({ description: 'Statement start date' })
  periodStart!: Date;

  @ApiProperty({ description: 'Statement end date' })
  periodEnd!: Date;

  @ApiProperty({ description: 'Opening balance at start of period' })
  openingBalance!: number;

  @ApiProperty({
    description: 'Statement line items',
    type: [StatementLineItemDto],
  })
  lineItems!: StatementLineItemDto[];

  @ApiProperty({ description: 'Total invoiced in period' })
  totalInvoiced!: number;

  @ApiProperty({ description: 'Total payments in period' })
  totalPayments!: number;

  @ApiProperty({ description: 'Total credits in period' })
  totalCredits!: number;

  @ApiProperty({ description: 'Closing balance at end of period' })
  closingBalance!: number;

  @ApiProperty({ description: 'Statement generated date' })
  generatedAt!: Date;
}

export class InvoiceStatementDto {
  @ApiProperty({ description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ description: 'Invoice number' })
  invoiceNumber!: string;

  @ApiProperty({ description: 'Client name' })
  clientName!: string;

  @ApiProperty({ description: 'Invoice date' })
  invoiceDate!: Date;

  @ApiProperty({ description: 'Due date' })
  dueDate!: Date;

  @ApiProperty({ description: 'Invoice status' })
  status!: string;

  @ApiProperty({ description: 'Invoice total' })
  invoiceTotal!: number;

  @ApiProperty({ description: 'Invoice line items paid status' })
  lineItems!: InvoiceLineItemStatusDto[];

  @ApiProperty({ description: 'Payments made against this invoice' })
  payments!: InvoicePaymentDto[];

  @ApiProperty({ description: 'Total amount paid' })
  totalPaid!: number;

  @ApiProperty({ description: 'Remaining balance' })
  balance!: number;

  @ApiProperty({ description: 'Statement generated date' })
  generatedAt!: Date;
}

export class InvoiceLineItemStatusDto {
  @ApiProperty({ description: 'Line item ID' })
  itemId!: string;

  @ApiProperty({ description: 'Item description' })
  description!: string;

  @ApiProperty({ description: 'Line total (including tax)' })
  lineTotal!: number;

  @ApiProperty({ description: 'Amount paid towards this item' })
  amountPaid!: number;

  @ApiProperty({ description: 'Amount remaining on this item' })
  amountRemaining!: number;

  @ApiProperty({ description: 'Whether this item is fully paid' })
  isPaid!: boolean;
}

export class InvoicePaymentDto {
  @ApiProperty({ description: 'Payment ID' })
  paymentId!: string;

  @ApiProperty({ description: 'Payment number' })
  paymentNumber!: string;

  @ApiProperty({ description: 'Payment date' })
  paymentDate!: Date;

  @ApiProperty({ description: 'Payment amount' })
  amount!: number;

  @ApiProperty({ description: 'Payment method' })
  paymentMethod!: string;

  @ApiPropertyOptional({ description: 'External reference' })
  reference?: string;
}

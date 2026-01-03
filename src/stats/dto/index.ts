import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceStatsDto {
  @ApiProperty({ description: 'Total number of invoices' })
  totalInvoices!: number;

  @ApiProperty({ description: 'Number of draft invoices' })
  draftCount!: number;

  @ApiProperty({ description: 'Number of sent invoices' })
  sentCount!: number;

  @ApiProperty({ description: 'Number of paid invoices' })
  paidCount!: number;

  @ApiProperty({ description: 'Number of overdue invoices' })
  overdueCount!: number;

  @ApiProperty({ description: 'Number of partial payment invoices' })
  partialCount!: number;

  @ApiProperty({ description: 'Total revenue (paid invoices)' })
  totalRevenue!: number;

  @ApiProperty({ description: 'Total outstanding amount' })
  totalOutstanding!: number;

  @ApiProperty({ description: 'Total overdue amount' })
  totalOverdue!: number;
}

export class QuoteStatsDto {
  @ApiProperty({ description: 'Total number of quotes' })
  totalQuotes!: number;

  @ApiProperty({ description: 'Number of accepted quotes' })
  acceptedCount!: number;

  @ApiProperty({ description: 'Number of rejected quotes' })
  rejectedCount!: number;

  @ApiProperty({
    description: 'Number of pending quotes (draft, sent, viewed)',
  })
  pendingCount!: number;

  @ApiProperty({ description: 'Number of converted quotes' })
  convertedCount!: number;

  @ApiProperty({ description: 'Total value of accepted quotes' })
  totalAcceptedValue!: number;

  @ApiProperty({
    description: 'Conversion rate (accepted / (accepted + rejected))',
  })
  conversionRate!: number;
}

export class CompanyStatsDto {
  @ApiProperty({ description: 'Invoice statistics', type: InvoiceStatsDto })
  invoices!: InvoiceStatsDto;

  @ApiProperty({ description: 'Quote statistics', type: QuoteStatsDto })
  quotes!: QuoteStatsDto;

  @ApiProperty({ description: 'Total number of clients' })
  totalClients!: number;

  @ApiProperty({ description: 'Total number of products' })
  totalProducts!: number;
}

export class ClientStatsDto {
  @ApiProperty({ description: 'Client ID' })
  clientId!: string;

  @ApiProperty({ description: 'Client name' })
  clientName!: string;

  @ApiProperty({ description: 'Total number of invoices' })
  totalInvoices!: number;

  @ApiProperty({ description: 'Total invoiced amount' })
  totalInvoiced!: number;

  @ApiProperty({ description: 'Total paid amount' })
  totalPaid!: number;

  @ApiProperty({ description: 'Outstanding balance' })
  outstandingBalance!: number;

  @ApiProperty({ description: 'Overdue amount' })
  overdueAmount!: number;

  @ApiProperty({ description: 'Number of quotes' })
  totalQuotes!: number;

  @ApiProperty({ description: 'Number of credit notes' })
  totalCreditNotes!: number;

  @ApiPropertyOptional({ description: 'Last invoice date' })
  lastInvoiceDate?: Date;
}

import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { StatementService } from './statement.service';
import { ClientStatementDto, InvoiceStatementDto } from './dto';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { PdfService } from '../shared/pdf/pdf.service';
import { CompanyService } from '../company/company.service';

@ApiTags('Statements')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('statements')
export class StatementController {
  constructor(
    private readonly statementService: StatementService,
    private readonly pdfService: PdfService,
    private readonly companyService: CompanyService,
  ) {}

  @Get('client/:clientId')
  @ApiOperation({
    summary: 'Get client statement',
    description:
      'Returns a statement showing all invoices, payments, and credits for a client',
  })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format). Defaults to 30 days ago',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format). Defaults to today',
  })
  @ApiResponse({
    status: 200,
    description: 'Client statement',
    type: ClientStatementDto,
  })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientStatement(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('companyId') companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ClientStatementDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statementService.getClientStatement({
      clientId,
      companyId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('client/:clientId/pdf')
  @ApiOperation({ summary: 'Generate PDF statement for client' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'download',
    required: false,
    type: Boolean,
    description: 'Set to true to download as attachment',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientStatementPdf(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('companyId') companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('download') download?: string,
    @Res() res?: Response,
  ): Promise<void> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const statement = await this.statementService.getClientStatement({
      clientId,
      companyId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const company = await this.companyService.findById(companyId);
    const pdfBuffer = await this.pdfService.generateClientStatementPdf(
      statement,
      company,
    );

    const filename = `statement-${statement.clientName.replace(/\s+/g, '-')}-${this.formatDateForFilename(statement.periodEnd)}.pdf`;
    const disposition = download === 'true' ? 'attachment' : 'inline';

    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res!.end(pdfBuffer);
  }

  @Get('invoice/:invoiceId')
  @ApiOperation({
    summary: 'Get invoice statement',
    description:
      'Returns a detailed statement showing payment status for each line item',
  })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Invoice statement',
    type: InvoiceStatementDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceStatement(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Query('companyId') companyId: string,
  ): Promise<InvoiceStatementDto> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.statementService.getInvoiceStatement({
      invoiceId,
      companyId,
    });
  }

  @Get('invoice/:invoiceId/pdf')
  @ApiOperation({ summary: 'Generate PDF statement for invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'download',
    required: false,
    type: Boolean,
    description: 'Set to true to download as attachment',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceStatementPdf(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Query('companyId') companyId: string,
    @Query('download') download?: string,
    @Res() res?: Response,
  ): Promise<void> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const statement = await this.statementService.getInvoiceStatement({
      invoiceId,
      companyId,
    });

    const company = await this.companyService.findById(companyId);
    const pdfBuffer = await this.pdfService.generateInvoiceStatementPdf(
      statement,
      company,
    );

    const filename = `statement-${statement.invoiceNumber}.pdf`;
    const disposition = download === 'true' ? 'attachment' : 'inline';

    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res!.end(pdfBuffer);
  }

  private formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

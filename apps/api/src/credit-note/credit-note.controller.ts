import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
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
import { CreditNoteService } from './credit-note.service';
import {
  CreateCreditNoteDto,
  UpdateCreditNoteDto,
  VoidCreditNoteDto,
  ApplyCreditNoteDto,
  CreateCreditNoteItemDto,
} from './dto';
import type { CreditNoteStatus } from './credit-note.entity';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { PdfService } from '../shared/pdf/pdf.service';
import { CompanyService } from '../company/company.service';
import { Idempotent } from '../shared/decorators/idempotent.decorator';

@ApiTags('Credit Notes')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('credit-notes')
export class CreditNoteController {
  constructor(
    private readonly creditNoteService: CreditNoteService,
    private readonly pdfService: PdfService,
    private readonly companyService: CompanyService,
  ) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a new credit note' })
  @ApiResponse({ status: 201, description: 'Credit note created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() dto: CreateCreditNoteDto) {
    return this.creditNoteService.create({ dto });
  }

  @Get()
  @ApiOperation({ summary: 'List all credit notes for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'issued', 'applied', 'voided'],
  })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  findAll(
    @Query('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('status') status?: CreditNoteStatus,
    @Query('clientId') clientId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.findAll({
      companyId,
      page,
      perPage,
      status,
      clientId,
      invoiceId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a credit note by ID' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Credit note found' })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.findById({ id, companyId });
  }

  @Put(':id')
  @Idempotent()
  @ApiOperation({ summary: 'Update credit note (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Credit note updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Can only update draft credit notes',
  })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateCreditNoteDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.update({ id, companyId, dto });
  }

  @Post(':id/issue')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue the credit note' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Credit note issued' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.issue({ id, companyId });
  }

  @Post(':id/apply')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply credit note to an invoice' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Credit applied to invoice' })
  @ApiResponse({ status: 400, description: 'Insufficient credit balance' })
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: ApplyCreditNoteDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.apply({ id, companyId, dto });
  }

  @Delete(':id')
  @Idempotent()
  @ApiOperation({ summary: 'Void a credit note' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Credit note voided' })
  @ApiResponse({ status: 400, description: 'Cannot void applied credit note' })
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: VoidCreditNoteDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.void({ id, companyId, dto });
  }

  // Item management
  @Post(':id/items')
  @Idempotent()
  @ApiOperation({ summary: 'Add item to credit note (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: CreateCreditNoteItemDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.addItem({ creditNoteId: id, companyId, dto });
  }

  @Put(':id/items/:itemId')
  @Idempotent()
  @ApiOperation({ summary: 'Update credit note item (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId') companyId: string,
    @Body() dto: Partial<CreateCreditNoteItemDto>,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.updateItem({
      creditNoteId: id,
      itemId,
      companyId,
      dto,
    });
  }

  @Delete(':id/items/:itemId')
  @Idempotent()
  @ApiOperation({ summary: 'Remove item from credit note (draft only)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.creditNoteService.removeItem({
      creditNoteId: id,
      itemId,
      companyId,
    });
  }

  // PDF Generation
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate PDF for credit note' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({
    name: 'download',
    required: false,
    type: Boolean,
    description: 'Set to true to download as attachment',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Credit note not found' })
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const creditNote = await this.creditNoteService.findById({ id, companyId });
    const company = await this.companyService.findById({ id: companyId });

    const pdfBuffer = await this.pdfService.generateCreditNotePdf(
      creditNote,
      company,
    );

    const filename = `${creditNote.creditNoteNumber}.pdf`;
    const disposition = download === 'true' ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}

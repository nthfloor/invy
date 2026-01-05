import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { CreateTaxDto, UpdateTaxDto } from './dto';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { Idempotent } from '../shared/decorators/idempotent.decorator';

@ApiTags('Taxes')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('taxes')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a new tax rate' })
  @ApiResponse({ status: 201, description: 'Tax created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid company ID' })
  create(@Body() dto: CreateTaxDto) {
    return this.taxService.create({ dto });
  }

  @Get()
  @ApiOperation({ summary: 'List all taxes for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  findAll(@Query('companyId') companyId: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.taxService.findAll({ companyId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tax by ID' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Tax found' })
  @ApiResponse({ status: 404, description: 'Tax not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.taxService.findById({ id, companyId });
  }

  @Put(':id')
  @Idempotent()
  @ApiOperation({ summary: 'Update a tax' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Tax updated successfully' })
  @ApiResponse({ status: 404, description: 'Tax not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateTaxDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.taxService.update({ id, companyId, dto });
  }

  @Put(':id/default')
  @Idempotent()
  @ApiOperation({ summary: 'Set tax as default for company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Tax set as default' })
  @ApiResponse({ status: 404, description: 'Tax not found' })
  setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.taxService.setDefault({ id, companyId });
  }

  @Delete(':id')
  @Idempotent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a tax' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 204, description: 'Tax deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Tax not found' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.taxService.deactivate({ id, companyId });
  }
}

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
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto';
import { ApiTokenGuard } from '../shared/auth/api-token.guard';
import { Idempotent } from '../shared/decorators/idempotent.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(ApiTokenGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid company ID' })
  create(@Body() dto: CreateProductDto) {
    return this.productService.create({ dto });
  }

  @Get()
  @ApiOperation({ summary: 'List all products for a company' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('search') search?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.productService.findAll({ companyId, page, perPage, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.productService.findById({ id, companyId });
  }

  @Put(':id')
  @Idempotent()
  @ApiOperation({ summary: 'Update a product' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateProductDto,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.productService.update({ id, companyId, dto });
  }

  @Delete(':id')
  @Idempotent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a product (soft delete)' })
  @ApiQuery({ name: 'companyId', required: true, type: String })
  @ApiResponse({ status: 204, description: 'Product archived successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
    return this.productService.archive({ id, companyId });
  }
}

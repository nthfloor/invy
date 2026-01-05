import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
import { CompanyService } from '../company/company.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly companyService: CompanyService,
  ) {}

  async create({ dto }: { dto: CreateProductDto }): Promise<ProductEntity> {
    // Validate company exists
    const companyExists = await this.companyService.exists({
      id: dto.companyId,
    });
    if (!companyExists) {
      throw new BadRequestException(
        `Company with ID ${dto.companyId} not found`,
      );
    }

    const product = this.productRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      name: dto.name,
      description: dto.description,
      unitPrice: dto.unitPrice,
      taxId: dto.taxId,
      sku: dto.sku,
      isActive: true,
    });

    const saved = await this.productRepository.save(product);
    this.logger.log(`Created product: ${saved.id} - ${saved.name}`);

    return saved;
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateProductDto;
  }): Promise<ProductEntity> {
    const product = await this.findById({ id, companyId });

    Object.assign(product, dto);

    const saved = await this.productRepository.save(product);
    this.logger.log(`Updated product: ${saved.id}`);

    return saved;
  }

  async findById({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id, companyId },
      relations: ['tax'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findAll({
    companyId,
    page,
    perPage,
    search,
  }: {
    companyId: string;
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<PaginatedResult<ProductEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.tax', 'tax')
      .where('product.companyId = :companyId', { companyId })
      .andWhere('product.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('product.name', 'ASC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  async archive({
    id,
    companyId,
  }: {
    id: string;
    companyId: string;
  }): Promise<void> {
    const product = await this.findById({ id, companyId });
    product.isActive = false;
    await this.productRepository.save(product);
    this.logger.log(`Archived product: ${id}`);
  }
}

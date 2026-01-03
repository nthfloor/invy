import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from './company.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async create(dto: CreateCompanyDto): Promise<CompanyEntity> {
    // Check for duplicate taxId if provided
    if (dto.taxId) {
      const existing = await this.companyRepository.findOne({
        where: { taxId: dto.taxId },
      });
      if (existing) {
        throw new ConflictException(
          `Company with tax ID ${dto.taxId} already exists`,
        );
      }
    }

    const company = this.companyRepository.create({
      id: generateUUID(),
      name: dto.name,
      taxId: dto.taxId,
      currency: dto.currency || 'ZAR',
      address: dto.address,
      settings: dto.settings || {
        invoicePrefix: 'INV',
        quotePrefix: 'QUO',
        estimatePrefix: 'EST',
        paymentTermsDays: 30,
        quoteValidityDays: 30,
      },
      branding: dto.branding,
      isActive: true,
    });

    const saved = await this.companyRepository.save(company);
    this.logger.log(`Created company: ${saved.id} - ${saved.name}`);

    return saved;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyEntity> {
    const company = await this.findById(id);

    // Check for duplicate taxId if being changed
    if (dto.taxId && dto.taxId !== company.taxId) {
      const existing = await this.companyRepository.findOne({
        where: { taxId: dto.taxId },
      });
      if (existing) {
        throw new ConflictException(
          `Company with tax ID ${dto.taxId} already exists`,
        );
      }
    }

    if (dto.name !== undefined) company.name = dto.name;
    if (dto.taxId !== undefined) company.taxId = dto.taxId;
    if (dto.currency !== undefined) company.currency = dto.currency;
    if (dto.address !== undefined) company.address = dto.address;
    if (dto.settings !== undefined) {
      company.settings = { ...company.settings, ...dto.settings };
    }
    if (dto.branding !== undefined) {
      company.branding = { ...company.branding, ...dto.branding };
    }
    if (dto.isActive !== undefined) company.isActive = dto.isActive;

    const saved = await this.companyRepository.save(company);
    this.logger.log(`Updated company: ${saved.id}`);

    return saved;
  }

  async findById(id: string): Promise<CompanyEntity> {
    const company = await this.companyRepository.findOne({ where: { id } });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async findAll(
    page?: number,
    perPage?: number,
  ): Promise<PaginatedResult<CompanyEntity>> {
    const { skip, take, page: currentPage, perPage: itemsPerPage } =
      getPaginationParams(page, perPage);

    const [data, total] = await this.companyRepository.findAndCount({
      where: { isActive: true },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  async archive(id: string): Promise<void> {
    const company = await this.findById(id);
    company.isActive = false;
    await this.companyRepository.save(company);
    this.logger.log(`Archived company: ${id}`);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.companyRepository.count({ where: { id } });
    return count > 0;
  }
}

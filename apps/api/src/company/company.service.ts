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
import { DEFAULT_CURRENCY } from '../shared/constants/currencies';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async create({ dto }: { dto: CreateCompanyDto }): Promise<CompanyEntity> {
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
      email: dto.email,
      phone: dto.phone,
      taxId: dto.taxId,
      taxNumber: dto.taxNumber,
      registrationNumber: dto.registrationNumber,
      currency: dto.currency || DEFAULT_CURRENCY,
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

  async update({
    id,
    dto,
  }: {
    id: string;
    dto: UpdateCompanyDto;
  }): Promise<CompanyEntity> {
    const company = await this.findById({ id });

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

    // Merge simple fields
    const { settings, branding, ...simpleFields } = dto;
    Object.assign(company, simpleFields);

    // Deep merge nested objects
    if (settings) company.settings = { ...company.settings, ...settings };
    if (branding) company.branding = { ...company.branding, ...branding };

    const saved = await this.companyRepository.save(company);
    this.logger.log(`Updated company: ${saved.id}`);

    return saved;
  }

  async findById({ id }: { id: string }): Promise<CompanyEntity> {
    const company = await this.companyRepository.findOne({ where: { id } });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async findAll({
    page,
    perPage,
  }: {
    page?: number;
    perPage?: number;
  } = {}): Promise<PaginatedResult<CompanyEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const [data, total] = await this.companyRepository.findAndCount({
      where: { isActive: true },
      skip,
      take,
      order: { createdOn: 'DESC' },
    });

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  async archive({ id }: { id: string }): Promise<void> {
    const company = await this.findById({ id });
    company.isActive = false;
    await this.companyRepository.save(company);
    this.logger.log(`Archived company: ${id}`);
  }

  async exists({ id }: { id: string }): Promise<boolean> {
    const count = await this.companyRepository.count({ where: { id } });
    return count > 0;
  }
}

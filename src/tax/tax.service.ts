import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxEntity } from './tax.entity';
import { CreateTaxDto, UpdateTaxDto } from './dto';
import { CompanyService } from '../company/company.service';
import { generateUUID } from '../shared/utils/uuid';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(
    @InjectRepository(TaxEntity)
    private readonly taxRepository: Repository<TaxEntity>,
    private readonly companyService: CompanyService,
  ) {}

  async create(dto: CreateTaxDto): Promise<TaxEntity> {
    // Validate company exists
    const companyExists = await this.companyService.exists(dto.companyId);
    if (!companyExists) {
      throw new BadRequestException(
        `Company with ID ${dto.companyId} not found`,
      );
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.taxRepository.update(
        { companyId: dto.companyId, isDefault: true },
        { isDefault: false },
      );
    }

    const tax = this.taxRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      name: dto.name,
      rate: dto.rate,
      isDefault: dto.isDefault || false,
      isActive: true,
    });

    const saved = await this.taxRepository.save(tax);
    this.logger.log(`Created tax: ${saved.id} - ${saved.name}`);

    return saved;
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateTaxDto;
  }): Promise<TaxEntity> {
    const tax = await this.findById(id, companyId);

    if (dto.name !== undefined) tax.name = dto.name;
    if (dto.rate !== undefined) tax.rate = dto.rate;
    if (dto.isActive !== undefined) tax.isActive = dto.isActive;

    const saved = await this.taxRepository.save(tax);
    this.logger.log(`Updated tax: ${saved.id}`);

    return saved;
  }

  async setDefault(id: string, companyId: string): Promise<TaxEntity> {
    const tax = await this.findById(id, companyId);

    // Unset other defaults
    await this.taxRepository.update(
      { companyId, isDefault: true },
      { isDefault: false },
    );

    // Set this as default
    tax.isDefault = true;
    const saved = await this.taxRepository.save(tax);
    this.logger.log(`Set tax ${id} as default for company ${companyId}`);

    return saved;
  }

  async findById(id: string, companyId: string): Promise<TaxEntity> {
    const tax = await this.taxRepository.findOne({
      where: { id, companyId },
    });

    if (!tax) {
      throw new NotFoundException(`Tax with ID ${id} not found`);
    }

    return tax;
  }

  async findAll(companyId: string): Promise<TaxEntity[]> {
    return this.taxRepository.find({
      where: { companyId, isActive: true },
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findDefault(companyId: string): Promise<TaxEntity | null> {
    return this.taxRepository.findOne({
      where: { companyId, isDefault: true, isActive: true },
    });
  }

  async deactivate(id: string, companyId: string): Promise<void> {
    const tax = await this.findById(id, companyId);
    tax.isActive = false;
    tax.isDefault = false;
    await this.taxRepository.save(tax);
    this.logger.log(`Deactivated tax: ${id}`);
  }
}

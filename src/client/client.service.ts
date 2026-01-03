import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientEntity } from './client.entity';
import { CreateClientDto, UpdateClientDto } from './dto';
import { CompanyService } from '../company/company.service';
import { generateUUID } from '../shared/utils/uuid';
import {
  PaginatedResult,
  createPaginatedResult,
  getPaginationParams,
} from '../shared/utils/pagination';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
    private readonly companyService: CompanyService,
  ) {}

  async create(dto: CreateClientDto): Promise<ClientEntity> {
    // Validate company exists
    const companyExists = await this.companyService.exists(dto.companyId);
    if (!companyExists) {
      throw new BadRequestException(
        `Company with ID ${dto.companyId} not found`,
      );
    }

    // Check for duplicate email within the same company
    const existing = await this.clientRepository.findOne({
      where: { email: dto.email, companyId: dto.companyId },
    });

    if (existing) {
      throw new ConflictException(
        `Client with email ${dto.email} already exists in this company`,
      );
    }

    const client = this.clientRepository.create({
      id: generateUUID(),
      companyId: dto.companyId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      externalId: dto.externalId,
      notes: dto.notes,
      isActive: true,
    });

    const saved = await this.clientRepository.save(client);
    this.logger.log(`Created client: ${saved.id} - ${saved.name}`);

    return saved;
  }

  async update({
    id,
    companyId,
    dto,
  }: {
    id: string;
    companyId: string;
    dto: UpdateClientDto;
  }): Promise<ClientEntity> {
    const client = await this.findById(id, companyId);

    // Check for duplicate email if being changed
    if (dto.email && dto.email !== client.email) {
      const existing = await this.clientRepository.findOne({
        where: { email: dto.email, companyId },
      });
      if (existing) {
        throw new ConflictException(
          `Client with email ${dto.email} already exists in this company`,
        );
      }
    }

    if (dto.name !== undefined) client.name = dto.name;
    if (dto.email !== undefined) client.email = dto.email;
    if (dto.phone !== undefined) client.phone = dto.phone;
    if (dto.address !== undefined) client.address = dto.address;
    if (dto.externalId !== undefined) client.externalId = dto.externalId;
    if (dto.notes !== undefined) client.notes = dto.notes;
    if (dto.isActive !== undefined) client.isActive = dto.isActive;

    const saved = await this.clientRepository.save(client);
    this.logger.log(`Updated client: ${saved.id}`);

    return saved;
  }

  async findById(id: string, companyId: string): Promise<ClientEntity> {
    const client = await this.clientRepository.findOne({
      where: { id, companyId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async findByExternalId(
    externalId: string,
    companyId: string,
  ): Promise<ClientEntity | null> {
    return this.clientRepository.findOne({
      where: { externalId, companyId },
    });
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
  }): Promise<PaginatedResult<ClientEntity>> {
    const {
      skip,
      take,
      page: currentPage,
      perPage: itemsPerPage,
    } = getPaginationParams(page, perPage);

    const queryBuilder = this.clientRepository
      .createQueryBuilder('client')
      .where('client.companyId = :companyId', { companyId })
      .andWhere('client.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(client.name ILIKE :search OR client.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(take)
      .orderBy('client.createdAt', 'DESC')
      .getManyAndCount();

    return createPaginatedResult(data, total, currentPage, itemsPerPage);
  }

  async archive(id: string, companyId: string): Promise<void> {
    const client = await this.findById(id, companyId);
    client.isActive = false;
    await this.clientRepository.save(client);
    this.logger.log(`Archived client: ${id}`);
  }

  async exists(id: string, companyId: string): Promise<boolean> {
    const count = await this.clientRepository.count({
      where: { id, companyId },
    });
    return count > 0;
  }
}

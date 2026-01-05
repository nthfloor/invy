/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ClientService } from '../../../src/client/client.service';
import { ClientEntity } from '../../../src/client/client.entity';
import { CompanyService } from '../../../src/company/company.service';

describe('ClientService', () => {
  let service: ClientService;
  let clientRepository: jest.Mocked<Repository<ClientEntity>>;
  let companyService: jest.Mocked<CompanyService>;

  const mockClient: ClientEntity = {
    id: 'client-uuid',
    companyId: 'company-uuid',
    name: 'Test Client',
    email: 'test@example.com',
    phone: '+1234567890',
    address: { line1: '123 Main St', city: 'Test City' },
    externalId: 'ext-123',
    notes: 'Test notes',
    isActive: true,
    createdOn: new Date(),
    updatedOn: new Date(),
  };

  const createMockQueryBuilder = () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockClient], 1]),
    } as unknown as jest.Mocked<SelectQueryBuilder<ClientEntity>>;
    return queryBuilder;
  };

  beforeEach(async () => {
    const mockClientRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCompanyService = {
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: getRepositoryToken(ClientEntity),
          useValue: mockClientRepository,
        },
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientRepository = module.get(getRepositoryToken(ClientEntity));
    companyService = module.get(CompanyService);
  });

  describe('create', () => {
    it('should create a new client', async () => {
      companyService.exists.mockResolvedValue(true);
      clientRepository.findOne.mockResolvedValue(null);
      clientRepository.create.mockReturnValue(mockClient);
      clientRepository.save.mockResolvedValue(mockClient);

      const result = await service.create({
        dto: {
          companyId: 'company-uuid',
          name: 'Test Client',
          email: 'test@example.com',
        },
      });

      expect(result).toEqual(mockClient);
      expect(companyService.exists).toHaveBeenCalledWith({
        id: 'company-uuid',
      });
    });

    it('should throw BadRequestException if company does not exist', async () => {
      companyService.exists.mockResolvedValue(false);

      await expect(
        service.create({
          dto: {
            companyId: 'invalid-uuid',
            name: 'Test Client',
            email: 'test@example.com',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if email already exists', async () => {
      companyService.exists.mockResolvedValue(true);
      clientRepository.findOne.mockResolvedValue(mockClient);

      await expect(
        service.create({
          dto: {
            companyId: 'company-uuid',
            name: 'New Client',
            email: 'test@example.com',
          },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a client by ID', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);

      const result = await service.findById({
        id: 'client-uuid',
        companyId: 'company-uuid',
      });

      expect(result).toEqual(mockClient);
      expect(clientRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'client-uuid', companyId: 'company-uuid' },
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByExternalId', () => {
    it('should return a client by external ID', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);

      const result = await service.findByExternalId({
        externalId: 'ext-123',
        companyId: 'company-uuid',
      });

      expect(result).toEqual(mockClient);
      expect(clientRepository.findOne).toHaveBeenCalledWith({
        where: { externalId: 'ext-123', companyId: 'company-uuid' },
      });
    });

    it('should return null if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      const result = await service.findByExternalId({
        externalId: 'invalid',
        companyId: 'company-uuid',
      });

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const updatedClient = { ...mockClient, name: 'Updated Name' };
      clientRepository.findOne.mockResolvedValue(mockClient);
      clientRepository.save.mockResolvedValue(updatedClient);

      const result = await service.update({
        id: 'client-uuid',
        companyId: 'company-uuid',
        dto: { name: 'Updated Name' },
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictException when changing to existing email', async () => {
      const existingClient = { ...mockClient, id: 'other-uuid' };
      clientRepository.findOne
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(existingClient);

      await expect(
        service.update({
          id: 'client-uuid',
          companyId: 'company-uuid',
          dto: { email: 'existing@example.com' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update({
          id: 'invalid-uuid',
          companyId: 'company-uuid',
          dto: { name: 'New Name' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      const queryBuilder = createMockQueryBuilder();
      clientRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll({
        companyId: 'company-uuid',
        page: 1,
        perPage: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(queryBuilder.where).toHaveBeenCalled();
    });

    it('should filter by search term', async () => {
      const queryBuilder = createMockQueryBuilder();
      clientRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findAll({
        companyId: 'company-uuid',
        search: 'test',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(client.name ILIKE :search OR client.email ILIKE :search)',
        { search: '%test%' },
      );
    });
  });

  describe('archive', () => {
    it('should archive a client', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      clientRepository.save.mockResolvedValue({
        ...mockClient,
        isActive: false,
      });

      await service.archive({
        id: 'client-uuid',
        companyId: 'company-uuid',
      });

      expect(clientRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(
        service.archive({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('exists', () => {
    it('should return true if client exists', async () => {
      clientRepository.count.mockResolvedValue(1);

      const result = await service.exists({
        id: 'client-uuid',
        companyId: 'company-uuid',
      });

      expect(result).toBe(true);
    });

    it('should return false if client does not exist', async () => {
      clientRepository.count.mockResolvedValue(0);

      const result = await service.exists({
        id: 'invalid-uuid',
        companyId: 'company-uuid',
      });

      expect(result).toBe(false);
    });
  });
});

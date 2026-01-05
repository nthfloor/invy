/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaxService } from '../../../src/tax/tax.service';
import { TaxEntity } from '../../../src/tax/tax.entity';
import { CompanyService } from '../../../src/company/company.service';

describe('TaxService', () => {
  let service: TaxService;
  let taxRepository: jest.Mocked<Repository<TaxEntity>>;
  let companyService: jest.Mocked<CompanyService>;

  const mockTax: TaxEntity = {
    id: 'tax-uuid',
    companyId: 'company-uuid',
    name: 'VAT 15%',
    rate: 15,
    isDefault: false,
    isActive: true,
    createdOn: new Date(),
    updatedOn: new Date(),
  };

  beforeEach(async () => {
    const mockTaxRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    const mockCompanyService = {
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: getRepositoryToken(TaxEntity), useValue: mockTaxRepository },
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
    taxRepository = module.get(getRepositoryToken(TaxEntity));
    companyService = module.get(CompanyService);
  });

  describe('create', () => {
    it('should create a new tax rate', async () => {
      companyService.exists.mockResolvedValue(true);
      taxRepository.create.mockReturnValue(mockTax);
      taxRepository.save.mockResolvedValue(mockTax);

      const result = await service.create({
        dto: {
          companyId: 'company-uuid',
          name: 'VAT 15%',
          rate: 15,
        },
      });

      expect(result).toEqual(mockTax);
      expect(companyService.exists).toHaveBeenCalledWith({
        id: 'company-uuid',
      });
      expect(taxRepository.create).toHaveBeenCalled();
      expect(taxRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if company does not exist', async () => {
      companyService.exists.mockResolvedValue(false);

      await expect(
        service.create({
          dto: {
            companyId: 'invalid-uuid',
            name: 'VAT 15%',
            rate: 15,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unset other defaults when creating a default tax', async () => {
      companyService.exists.mockResolvedValue(true);
      const defaultTax = { ...mockTax, isDefault: true };
      taxRepository.create.mockReturnValue(defaultTax);
      taxRepository.save.mockResolvedValue(defaultTax);
      taxRepository.update.mockResolvedValue({ affected: 1 } as UpdateResult);

      await service.create({
        dto: {
          companyId: 'company-uuid',
          name: 'VAT 15%',
          rate: 15,
          isDefault: true,
        },
      });

      expect(taxRepository.update).toHaveBeenCalledWith(
        { companyId: 'company-uuid', isDefault: true },
        { isDefault: false },
      );
    });
  });

  describe('findById', () => {
    it('should return a tax by ID', async () => {
      taxRepository.findOne.mockResolvedValue(mockTax);

      const result = await service.findById({
        id: 'tax-uuid',
        companyId: 'company-uuid',
      });

      expect(result).toEqual(mockTax);
      expect(taxRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tax-uuid', companyId: 'company-uuid' },
      });
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a tax', async () => {
      const updatedTax = { ...mockTax, name: 'VAT 20%', rate: 20 };
      taxRepository.findOne.mockResolvedValue(mockTax);
      taxRepository.save.mockResolvedValue(updatedTax);

      const result = await service.update({
        id: 'tax-uuid',
        companyId: 'company-uuid',
        dto: { name: 'VAT 20%', rate: 20 },
      });

      expect(result.name).toBe('VAT 20%');
      expect(result.rate).toBe(20);
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update({
          id: 'invalid-uuid',
          companyId: 'company-uuid',
          dto: { name: 'New Name' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDefault', () => {
    it('should set a tax as default', async () => {
      const defaultTax = { ...mockTax, isDefault: true };
      taxRepository.findOne.mockResolvedValue(mockTax);
      taxRepository.update.mockResolvedValue({ affected: 1 } as UpdateResult);
      taxRepository.save.mockResolvedValue(defaultTax);

      const result = await service.setDefault({
        id: 'tax-uuid',
        companyId: 'company-uuid',
      });

      expect(result.isDefault).toBe(true);
      expect(taxRepository.update).toHaveBeenCalledWith(
        { companyId: 'company-uuid', isDefault: true },
        { isDefault: false },
      );
    });
  });

  describe('findAll', () => {
    it('should return all active taxes for a company', async () => {
      const taxes = [mockTax, { ...mockTax, id: 'tax-uuid-2', name: 'GST' }];
      taxRepository.find.mockResolvedValue(taxes);

      const result = await service.findAll({ companyId: 'company-uuid' });

      expect(result).toHaveLength(2);
      expect(taxRepository.find).toHaveBeenCalledWith({
        where: { companyId: 'company-uuid', isActive: true },
        order: { isDefault: 'DESC', name: 'ASC' },
      });
    });
  });

  describe('findDefault', () => {
    it('should return the default tax for a company', async () => {
      const defaultTax = { ...mockTax, isDefault: true };
      taxRepository.findOne.mockResolvedValue(defaultTax);

      const result = await service.findDefault({ companyId: 'company-uuid' });

      expect(result?.isDefault).toBe(true);
      expect(taxRepository.findOne).toHaveBeenCalledWith({
        where: { companyId: 'company-uuid', isDefault: true, isActive: true },
      });
    });

    it('should return null if no default tax exists', async () => {
      taxRepository.findOne.mockResolvedValue(null);

      const result = await service.findDefault({ companyId: 'company-uuid' });

      expect(result).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('should deactivate a tax', async () => {
      taxRepository.findOne.mockResolvedValue(mockTax);
      taxRepository.save.mockResolvedValue({
        ...mockTax,
        isActive: false,
        isDefault: false,
      });

      await service.deactivate({
        id: 'tax-uuid',
        companyId: 'company-uuid',
      });

      expect(taxRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDefault: false }),
      );
    });

    it('should throw NotFoundException if tax not found', async () => {
      taxRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deactivate({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

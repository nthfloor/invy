/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductService } from '../../../src/product/product.service';
import { ProductEntity } from '../../../src/product/product.entity';
import { CompanyService } from '../../../src/company/company.service';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: jest.Mocked<Repository<ProductEntity>>;
  let companyService: jest.Mocked<CompanyService>;

  const mockProduct: ProductEntity = {
    id: 'product-uuid',
    companyId: 'company-uuid',
    name: 'Test Product',
    description: 'Test description',
    unitPrice: 100,
    taxId: 'tax-uuid',
    sku: 'SKU-001',
    isActive: true,
    createdOn: new Date(),
    updatedOn: new Date(),
  };

  const createMockQueryBuilder = () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockProduct], 1]),
    } as unknown as jest.Mocked<SelectQueryBuilder<ProductEntity>>;
    return queryBuilder;
  };

  beforeEach(async () => {
    const mockProductRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCompanyService = {
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepository,
        },
        { provide: CompanyService, useValue: mockCompanyService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get(getRepositoryToken(ProductEntity));
    companyService = module.get(CompanyService);
  });

  describe('create', () => {
    it('should create a new product', async () => {
      companyService.exists.mockResolvedValue(true);
      productRepository.create.mockReturnValue(mockProduct);
      productRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create({
        dto: {
          companyId: 'company-uuid',
          name: 'Test Product',
          unitPrice: 100,
        },
      });

      expect(result).toEqual(mockProduct);
      expect(companyService.exists).toHaveBeenCalledWith({
        id: 'company-uuid',
      });
      expect(productRepository.create).toHaveBeenCalled();
      expect(productRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if company does not exist', async () => {
      companyService.exists.mockResolvedValue(false);

      await expect(
        service.create({
          dto: {
            companyId: 'invalid-uuid',
            name: 'Test Product',
            unitPrice: 100,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return a product by ID', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);

      const result = await service.findById({
        id: 'product-uuid',
        companyId: 'company-uuid',
      });

      expect(result).toEqual(mockProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-uuid', companyId: 'company-uuid' },
        relations: ['tax'],
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findById({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updatedProduct = { ...mockProduct, name: 'Updated Product' };
      productRepository.findOne.mockResolvedValue(mockProduct);
      productRepository.save.mockResolvedValue(updatedProduct);

      const result = await service.update({
        id: 'product-uuid',
        companyId: 'company-uuid',
        dto: { name: 'Updated Product' },
      });

      expect(result.name).toBe('Updated Product');
    });

    it('should update multiple fields', async () => {
      const updatedProduct = {
        ...mockProduct,
        name: 'Updated Product',
        unitPrice: 200,
        sku: 'SKU-002',
      };
      productRepository.findOne.mockResolvedValue(mockProduct);
      productRepository.save.mockResolvedValue(updatedProduct);

      const result = await service.update({
        id: 'product-uuid',
        companyId: 'company-uuid',
        dto: { name: 'Updated Product', unitPrice: 200, sku: 'SKU-002' },
      });

      expect(result.name).toBe('Updated Product');
      expect(result.unitPrice).toBe(200);
      expect(result.sku).toBe('SKU-002');
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

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
    it('should return paginated products', async () => {
      const queryBuilder = createMockQueryBuilder();
      productRepository.createQueryBuilder.mockReturnValue(queryBuilder);

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
      productRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findAll({
        companyId: 'company-uuid',
        search: 'test',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: '%test%' },
      );
    });
  });

  describe('archive', () => {
    it('should archive a product', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);
      productRepository.save.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await service.archive({
        id: 'product-uuid',
        companyId: 'company-uuid',
      });

      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(
        service.archive({ id: 'invalid-uuid', companyId: 'company-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

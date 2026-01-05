import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsEmail,
  MaxLength,
  IsBoolean,
  Length,
} from 'class-validator';
import type {
  CompanyAddress,
  CompanySettings,
  CompanyBranding,
} from '../company.entity';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Company name', example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Company email',
    example: 'contact@acme.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Company phone number',
    example: '+27 11 123 4567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Tax ID (VAT/GST number)',
    example: 'VAT123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Tax registration number',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxNumber?: string;

  @ApiPropertyOptional({
    description: 'Company registration number',
    example: '2024/123456/07',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'ZAR',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsObject()
  address?: CompanyAddress;

  @ApiPropertyOptional({ description: 'Company settings' })
  @IsOptional()
  @IsObject()
  settings?: CompanySettings;

  @ApiPropertyOptional({ description: 'Company branding' })
  @IsOptional()
  @IsObject()
  branding?: CompanyBranding;

  @ApiPropertyOptional({ description: 'Whether the company is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsEmail,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { ClientAddress } from '../client.entity';

export class CreateClientDto {
  @ApiProperty({ description: 'Company ID this client belongs to' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'Client name', example: 'John Doe' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Client email', example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+27821234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Client address' })
  @IsOptional()
  @IsObject()
  address?: ClientAddress;

  @ApiPropertyOptional({
    description: 'External ID for sync from client registry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @ApiPropertyOptional({ description: 'Notes about the client' })
  @IsOptional()
  @IsString()
  notes?: string;
}

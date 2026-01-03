import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientEntity } from './client.entity';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { CompanyModule } from '../company/company.module';
import { ApiTokenEntity } from '../shared/entities/api-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientEntity, ApiTokenEntity]),
    CompanyModule,
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}

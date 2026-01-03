import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlnkBalanceMappingEntity } from './entities/blnk-balance-mapping.entity';
import { BlnkClientService } from './services/blnk-client.service';
import { BlnkBalanceManagerService } from './services/blnk-balance-manager.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlnkBalanceMappingEntity])],
  providers: [BlnkClientService, BlnkBalanceManagerService],
  exports: [BlnkClientService, BlnkBalanceManagerService],
})
export class BlnkModule {}

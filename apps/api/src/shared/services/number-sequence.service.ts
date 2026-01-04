import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  NumberSequenceEntity,
  SequenceType,
} from '../entities/number-sequence.entity';
import { generateUUID } from '../utils/uuid';

@Injectable()
export class NumberSequenceService {
  private readonly logger = new Logger(NumberSequenceService.name);

  constructor(
    @InjectRepository(NumberSequenceEntity)
    private readonly sequenceRepository: Repository<NumberSequenceEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getNextNumber({
    companyId,
    sequenceType,
    prefix,
  }: {
    companyId: string;
    sequenceType: SequenceType;
    prefix: string;
  }): Promise<string> {
    // Use transaction with pessimistic locking to prevent race conditions
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(NumberSequenceEntity);

      // Try to get existing sequence with lock
      let sequence = await repo.findOne({
        where: { companyId, sequenceType },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sequence) {
        // Create new sequence starting at 0
        sequence = repo.create({
          id: generateUUID(),
          companyId,
          sequenceType,
          lastNumber: 0,
        });
      }

      sequence.lastNumber += 1;
      await repo.save(sequence);

      // Format: PREFIX-0001 (padded to 4 digits)
      const paddedNumber = sequence.lastNumber.toString().padStart(4, '0');
      const formattedNumber = `${prefix}-${paddedNumber}`;

      this.logger.debug(
        `Generated ${sequenceType} number: ${formattedNumber} for company ${companyId}`,
      );

      return formattedNumber;
    });
  }

  async getCurrentNumber(
    companyId: string,
    sequenceType: SequenceType,
  ): Promise<number> {
    const sequence = await this.sequenceRepository.findOne({
      where: { companyId, sequenceType },
    });

    return sequence?.lastNumber ?? 0;
  }
}

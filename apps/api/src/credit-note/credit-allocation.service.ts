import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreditAllocationEntity,
  AllocationTargetType,
  AllocationStatus,
} from './credit-allocation.entity';
import { CreditNoteEntity } from './credit-note.entity';
import { generateUUID } from '../shared/utils/uuid';

export interface AllocateCreditParams {
  companyId: string;
  creditNoteId: string;
  targetType: AllocationTargetType;
  targetId: string;
  targetStatus: string;
  amount: number;
}

export interface ReleaseAllocationParams {
  companyId: string;
  allocationId: string;
  reason: string;
}

export interface FinalizeAllocationParams {
  companyId: string;
  allocationId: string;
}

export interface ReleaseAllocationsByTargetParams {
  companyId: string;
  targetType: AllocationTargetType;
  targetId: string;
  reason: string;
}

export interface FinalizeAllocationsByTargetParams {
  companyId: string;
  targetType: AllocationTargetType;
  targetId: string;
}

export interface TransferAllocationsParams {
  companyId: string;
  fromTargetType: AllocationTargetType;
  fromTargetId: string;
  toTargetType: AllocationTargetType;
  toTargetId: string;
  toTargetStatus: string;
}

@Injectable()
export class CreditAllocationService {
  private readonly logger = new Logger(CreditAllocationService.name);

  constructor(
    @InjectRepository(CreditAllocationEntity)
    private readonly allocationRepository: Repository<CreditAllocationEntity>,
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepository: Repository<CreditNoteEntity>,
  ) {}

  /**
   * Allocate credit from a credit note to a draft invoice or quote.
   * This reserves the credit but does not apply it until finalized.
   */
  async allocate(
    params: AllocateCreditParams,
  ): Promise<CreditAllocationEntity> {
    const {
      companyId,
      creditNoteId,
      targetType,
      targetId,
      targetStatus,
      amount,
    } = params;

    // Get the credit note
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id: creditNoteId, companyId },
    });

    if (!creditNote) {
      throw new NotFoundException(
        `Credit note with ID ${creditNoteId} not found`,
      );
    }

    // Credit note must be issued to allocate
    if (creditNote.status !== 'issued') {
      throw new BadRequestException(
        `Credit note must be issued before allocating. Current status: ${creditNote.status}`,
      );
    }

    // Calculate available balance (total - allocated - applied)
    const availableBalance =
      Number(creditNote.total) -
      Number(creditNote.allocatedAmount) -
      Number(creditNote.amountApplied);

    if (amount > availableBalance) {
      throw new BadRequestException(
        `Cannot allocate ${amount}. Available balance is ${availableBalance}`,
      );
    }

    if (amount <= 0) {
      throw new BadRequestException('Allocation amount must be greater than 0');
    }

    // Create allocation
    const allocation = this.allocationRepository.create({
      id: generateUUID(),
      companyId,
      creditNoteId,
      targetType,
      targetId,
      targetStatus,
      amount,
      status: 'pending',
    });

    await this.allocationRepository.save(allocation);

    // Update credit note allocated amount
    creditNote.allocatedAmount = Number(creditNote.allocatedAmount) + amount;
    creditNote.balance = availableBalance - amount;
    await this.creditNoteRepository.save(creditNote);

    this.logger.log(
      `Allocated ${amount} from credit note ${creditNoteId} to ${targetType} ${targetId}`,
    );

    return allocation;
  }

  /**
   * Release an allocation back to the credit note.
   * Used when a quote is rejected or draft invoice is cancelled.
   */
  async release(
    params: ReleaseAllocationParams,
  ): Promise<CreditAllocationEntity> {
    const { companyId, allocationId, reason } = params;

    const allocation = await this.allocationRepository.findOne({
      where: { id: allocationId, companyId },
    });

    if (!allocation) {
      throw new NotFoundException(
        `Allocation with ID ${allocationId} not found`,
      );
    }

    if (allocation.status !== 'pending') {
      throw new BadRequestException(
        `Can only release pending allocations. Current status: ${allocation.status}`,
      );
    }

    // Update allocation
    allocation.status = 'released';
    allocation.releasedAt = new Date();
    allocation.releaseReason = reason;
    await this.allocationRepository.save(allocation);

    // Restore credit note balance
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id: allocation.creditNoteId, companyId },
    });

    if (creditNote) {
      creditNote.allocatedAmount =
        Number(creditNote.allocatedAmount) - Number(allocation.amount);
      creditNote.balance =
        Number(creditNote.balance) + Number(allocation.amount);
      await this.creditNoteRepository.save(creditNote);
    }

    this.logger.log(
      `Released allocation ${allocationId} (${allocation.amount}) - ${reason}`,
    );

    return allocation;
  }

  /**
   * Finalize an allocation when the target document is sent/finalized.
   * Moves the amount from allocated to applied.
   */
  async finalize(
    params: FinalizeAllocationParams,
  ): Promise<CreditAllocationEntity> {
    const { companyId, allocationId } = params;

    const allocation = await this.allocationRepository.findOne({
      where: { id: allocationId, companyId },
    });

    if (!allocation) {
      throw new NotFoundException(
        `Allocation with ID ${allocationId} not found`,
      );
    }

    if (allocation.status !== 'pending') {
      throw new BadRequestException(
        `Can only finalize pending allocations. Current status: ${allocation.status}`,
      );
    }

    // Update allocation
    allocation.status = 'applied';
    allocation.appliedAt = new Date();
    await this.allocationRepository.save(allocation);

    // Move from allocated to applied on credit note
    const creditNote = await this.creditNoteRepository.findOne({
      where: { id: allocation.creditNoteId, companyId },
    });

    if (creditNote) {
      creditNote.allocatedAmount =
        Number(creditNote.allocatedAmount) - Number(allocation.amount);
      creditNote.amountApplied =
        Number(creditNote.amountApplied) + Number(allocation.amount);
      // Balance stays the same since we moved from allocated to applied
      await this.creditNoteRepository.save(creditNote);

      // Check if credit note is fully applied
      if (
        Number(creditNote.allocatedAmount) === 0 &&
        Number(creditNote.balance) === 0
      ) {
        creditNote.status = 'applied';
        await this.creditNoteRepository.save(creditNote);
      }
    }

    this.logger.log(
      `Finalized allocation ${allocationId} (${allocation.amount})`,
    );

    return allocation;
  }

  /**
   * Release all pending allocations for a target document.
   */
  async releaseAllByTarget(
    params: ReleaseAllocationsByTargetParams,
  ): Promise<CreditAllocationEntity[]> {
    const { companyId, targetType, targetId, reason } = params;

    const allocations = await this.allocationRepository.find({
      where: {
        companyId,
        targetType,
        targetId,
        status: 'pending',
      },
    });

    const released: CreditAllocationEntity[] = [];
    for (const allocation of allocations) {
      const result = await this.release({
        companyId,
        allocationId: allocation.id,
        reason,
      });
      released.push(result);
    }

    return released;
  }

  /**
   * Finalize all pending allocations for a target document.
   * Returns the total amount finalized.
   */
  async finalizeAllByTarget(
    params: FinalizeAllocationsByTargetParams,
  ): Promise<{ allocations: CreditAllocationEntity[]; totalAmount: number }> {
    const { companyId, targetType, targetId } = params;

    const allocations = await this.allocationRepository.find({
      where: {
        companyId,
        targetType,
        targetId,
        status: 'pending',
      },
    });

    let totalAmount = 0;
    const finalized: CreditAllocationEntity[] = [];

    for (const allocation of allocations) {
      const result = await this.finalize({
        companyId,
        allocationId: allocation.id,
      });
      finalized.push(result);
      totalAmount += Number(allocation.amount);
    }

    return { allocations: finalized, totalAmount };
  }

  /**
   * Transfer allocations from one target to another.
   * Used when converting a quote to an invoice.
   */
  async transfer(
    params: TransferAllocationsParams,
  ): Promise<CreditAllocationEntity[]> {
    const {
      companyId,
      fromTargetType,
      fromTargetId,
      toTargetType,
      toTargetId,
      toTargetStatus,
    } = params;

    const allocations = await this.allocationRepository.find({
      where: {
        companyId,
        targetType: fromTargetType,
        targetId: fromTargetId,
        status: 'pending',
      },
    });

    for (const allocation of allocations) {
      allocation.targetType = toTargetType;
      allocation.targetId = toTargetId;
      allocation.targetStatus = toTargetStatus;
    }

    await this.allocationRepository.save(allocations);

    this.logger.log(
      `Transferred ${allocations.length} allocations from ${fromTargetType}/${fromTargetId} to ${toTargetType}/${toTargetId}`,
    );

    return allocations;
  }

  /**
   * Get all allocations for a target document.
   */
  async findByTarget({
    companyId,
    targetType,
    targetId,
    status,
  }: {
    companyId: string;
    targetType: AllocationTargetType;
    targetId: string;
    status?: AllocationStatus;
  }): Promise<CreditAllocationEntity[]> {
    const where: Record<string, unknown> = {
      companyId,
      targetType,
      targetId,
    };

    if (status) {
      where.status = status;
    }

    return this.allocationRepository.find({
      where,
      relations: ['creditNote'],
      order: { createdOn: 'ASC' },
    });
  }

  /**
   * Get total pending allocation amount for a target.
   */
  async getPendingTotalByTarget({
    companyId,
    targetType,
    targetId,
  }: {
    companyId: string;
    targetType: AllocationTargetType;
    targetId: string;
  }): Promise<number> {
    const allocations = await this.allocationRepository.find({
      where: {
        companyId,
        targetType,
        targetId,
        status: 'pending',
      },
    });

    return allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  }

  /**
   * Get all allocations for a credit note.
   */
  async findByCreditNote({
    companyId,
    creditNoteId,
    status,
  }: {
    companyId: string;
    creditNoteId: string;
    status?: AllocationStatus;
  }): Promise<CreditAllocationEntity[]> {
    const where: Record<string, unknown> = {
      companyId,
      creditNoteId,
    };

    if (status) {
      where.status = status;
    }

    return this.allocationRepository.find({
      where,
      order: { createdOn: 'ASC' },
    });
  }
}

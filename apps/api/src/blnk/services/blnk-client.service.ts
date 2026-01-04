import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';

// ============================================
// Blnk API Types
// ============================================

export interface BlnkLedger {
  ledger_id: string;
  name: string;
  created_at: string;
  meta_data?: Record<string, unknown>;
}

export interface BlnkBalance {
  balance_id: string;
  ledger_id: string;
  balance: number;
  credit_balance: number;
  debit_balance: number;
  currency: string;
  created_at: string;
  meta_data?: Record<string, unknown>;
}

export interface BlnkTransaction {
  transaction_id: string;
  amount: number;
  reference: string;
  currency: string;
  status: 'QUEUED' | 'APPLIED' | 'REJECTED' | 'INFLIGHT';
  source: string;
  destination: string;
  description?: string;
  created_at: string;
  meta_data?: Record<string, unknown>;
}

export interface CreateLedgerDto {
  name: string;
  metaData?: Record<string, unknown>;
}

export interface CreateBalanceDto {
  ledgerId: string;
  currency: string;
  metaData?: Record<string, unknown>;
}

export interface RecordTransactionDto {
  amount: number;
  reference: string;
  currency: string;
  source: string;
  destination: string;
  description?: string;
  metaData?: Record<string, unknown>;
}

interface HttpRequestOptions {
  method: string;
  endpoint: string;
  body?: unknown;
  idempotencyKey?: string;
}

// ============================================
// Circuit Breaker Configuration
// ============================================

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: Required<CircuitBreakerOptions> = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  volumeThreshold: 5, // Minimum requests before tripping
};

/**
 * Blnk HTTP Client Service
 *
 * Provides low-level HTTP communication with the Blnk ledger API.
 * Includes circuit breaker pattern for resilience.
 */
@Injectable()
export class BlnkClientService {
  private readonly logger = new Logger(BlnkClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;
  private readonly circuitBreaker: CircuitBreaker<
    [HttpRequestOptions],
    unknown
  >;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('blnk.enabled', false);
    this.baseUrl = this.configService.get<string>(
      'blnk.url',
      'http://localhost:5001',
    );
    this.apiKey = this.configService.get<string>('blnk.apiKey', '');

    // Create circuit breaker for HTTP requests
    this.circuitBreaker = this.createCircuitBreaker(
      (options: HttpRequestOptions) => this.executeRequest(options),
    );

    if (this.enabled) {
      this.logger.log(`Blnk client initialized - URL: ${this.baseUrl}`);
    } else {
      this.logger.log('Blnk client disabled - running in standalone mode');
    }
  }

  /**
   * Check if Blnk integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create circuit breaker with standardized configuration
   */
  private createCircuitBreaker<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    options?: CircuitBreakerOptions,
  ): CircuitBreaker<T, R> {
    const mergedOptions = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };

    const circuitBreaker = new CircuitBreaker(fn, {
      timeout: mergedOptions.timeout,
      errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
      resetTimeout: mergedOptions.resetTimeout,
      volumeThreshold: mergedOptions.volumeThreshold,
    });

    circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker OPENED - Blnk unavailable');
    });

    circuitBreaker.on('halfOpen', () => {
      this.logger.log('Circuit breaker HALF-OPEN - Testing Blnk');
    });

    circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker CLOSED - Blnk recovered');
    });

    circuitBreaker.on('fallback', () => {
      this.logger.warn('Circuit breaker fallback triggered');
    });

    return circuitBreaker;
  }

  /**
   * Execute an HTTP request to Blnk
   */
  private async executeRequest<T>(options: HttpRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${options.endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Blnk-Key'] = this.apiKey;
    }

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Blnk API error: ${response.status} - ${errorText}`);
      throw new HttpException(
        `Blnk HTTP ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Make a request through the circuit breaker
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    if (!this.enabled) {
      throw new Error('Blnk integration is disabled');
    }

    try {
      return (await this.circuitBreaker.fire({
        method,
        endpoint,
        body,
        idempotencyKey,
      })) as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Circuit breaker open or other error
      this.logger.error(`Blnk request failed: ${error}`);
      throw new HttpException('Blnk service unavailable', 503);
    }
  }

  // ============================================
  // Ledger Operations
  // ============================================

  /**
   * Create a ledger in Blnk
   */
  async createLedger(dto: CreateLedgerDto): Promise<BlnkLedger> {
    this.logger.log(`Creating ledger: ${dto.name}`);

    const payload = {
      name: dto.name,
      meta_data: dto.metaData,
    };

    const ledger = await this.request<BlnkLedger>('POST', '/ledgers', payload);
    this.logger.log(`Created ledger: ${ledger.ledger_id}`);
    return ledger;
  }

  /**
   * Get a ledger by ID
   */
  async getLedger(ledgerId: string): Promise<BlnkLedger> {
    return this.request<BlnkLedger>('GET', `/ledgers/${ledgerId}`);
  }

  // ============================================
  // Balance Operations
  // ============================================

  /**
   * Create a balance (account) in Blnk
   */
  async createBalance(dto: CreateBalanceDto): Promise<BlnkBalance> {
    this.logger.log(`Creating balance in ledger: ${dto.ledgerId}`);

    const payload = {
      ledger_id: dto.ledgerId,
      currency: dto.currency,
      meta_data: dto.metaData,
    };

    const balance = await this.request<BlnkBalance>(
      'POST',
      '/balances',
      payload,
    );
    this.logger.log(`Created balance: ${balance.balance_id}`);
    return balance;
  }

  /**
   * Get a balance by ID
   */
  async getBalance(balanceId: string): Promise<BlnkBalance> {
    return this.request<BlnkBalance>('GET', `/balances/${balanceId}`);
  }

  // ============================================
  // Transaction Operations
  // ============================================

  /**
   * Record a transaction in Blnk
   */
  async recordTransaction(
    dto: RecordTransactionDto,
    idempotencyKey?: string,
  ): Promise<BlnkTransaction> {
    this.logger.log(`Recording transaction: ${dto.reference}`);

    const payload = {
      amount: dto.amount,
      reference: dto.reference,
      currency: dto.currency,
      source: dto.source,
      destination: dto.destination,
      description: dto.description,
      meta_data: dto.metaData,
    };

    const transaction = await this.request<BlnkTransaction>(
      'POST',
      '/transactions',
      payload,
      idempotencyKey,
    );
    this.logger.log(
      `Recorded transaction: ${transaction.transaction_id} (status: ${transaction.status})`,
    );
    return transaction;
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(transactionId: string): Promise<BlnkTransaction> {
    return this.request<BlnkTransaction>(
      'GET',
      `/transactions/${transactionId}`,
    );
  }

  // ============================================
  // Health & Status
  // ============================================

  /**
   * Get circuit breaker status for health checks
   */
  getCircuitBreakerStatus(): { state: string; stats: Record<string, unknown> } {
    return {
      state: this.circuitBreaker.opened
        ? 'OPEN'
        : this.circuitBreaker.halfOpen
          ? 'HALF_OPEN'
          : 'CLOSED',
      stats: this.circuitBreaker.stats as unknown as Record<string, unknown>,
    };
  }

  /**
   * Check if Blnk is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return true; // Consider healthy if disabled
    }

    try {
      // Simple health check - try to list ledgers
      await this.request('GET', '/ledgers');
      return true;
    } catch {
      return false;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { createActor, AnyStateMachine, Snapshot } from 'xstate';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowPersistenceService,
  CreateWorkflowStateParams,
} from './workflow-persistence.service';
import {
  WorkflowType,
  WorkflowStatus,
} from '../entities/workflow-state.entity';

export interface WorkflowExecutionParams<TContext, TInput> {
  /** The XState machine to execute */
  machine: AnyStateMachine;
  /** Input to pass to the machine */
  input: TInput;
  /** Type of workflow for persistence */
  workflowType: WorkflowType;
  /** Entity type (e.g., 'invoice', 'payment') */
  entityType: string;
  /** Entity ID being operated on */
  entityId: string;
  /** Company ID for multi-tenancy */
  companyId: string;
  /** Optional correlation ID for tracing */
  correlationId?: string;
  /** Callback when state transitions occur */
  onTransition?: (state: string, context: TContext) => void;
}

export interface WorkflowExecutionResult<TContext> {
  /** Whether the workflow completed successfully */
  success: boolean;
  /** Final state name */
  finalState: string;
  /** Final context with all accumulated data */
  context: TContext;
  /** Workflow ID for tracking */
  workflowId: string;
  /** Error message if failed */
  error?: string;
  /** Status of the workflow */
  status: WorkflowStatus;
}

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  constructor(
    private readonly persistenceService: WorkflowPersistenceService,
  ) {}

  /**
   * Execute a workflow (XState machine) with automatic persistence.
   * This method:
   * 1. Creates a workflow state record
   * 2. Runs the machine to completion
   * 3. Persists state on every transition
   * 4. Returns the final result
   */
  async execute<TContext extends object, TInput>(
    params: WorkflowExecutionParams<TContext, TInput>,
  ): Promise<WorkflowExecutionResult<TContext>> {
    const workflowId = uuidv4();
    const correlationId = params.correlationId ?? uuidv4();

    this.logger.log(
      `Starting workflow ${params.workflowType}:${workflowId} for ${params.entityType}:${params.entityId} (correlation: ${correlationId})`,
    );

    // Create initial workflow state
    const createParams: CreateWorkflowStateParams = {
      workflowType: params.workflowType,
      entityType: params.entityType,
      entityId: params.entityId,
      companyId: params.companyId,
      correlationId,
      initialState: 'starting',
      context: params.input as Record<string, unknown>,
    };

    const workflowState = await this.persistenceService.create(createParams);

    // Create the actor
    const actor = createActor(params.machine, {
      input: params.input,
    });

    return new Promise((resolve) => {
      actor.subscribe((snapshot: Snapshot<unknown>) => {
        void (async () => {
          // Get state value as string
          const stateValue = this.getStateValue(snapshot);

          // Get context
          const context =
            (snapshot as { context?: TContext }).context ?? ({} as TContext);

          // Call transition callback if provided
          if (params.onTransition) {
            try {
              params.onTransition(stateValue, context);
            } catch (error) {
              this.logger.warn(`Transition callback error: ${error}`);
            }
          }

          // Persist state on every transition (except when done)
          if (snapshot.status !== 'done') {
            try {
              await this.persistenceService.update({
                id: workflowState.id,
                currentState: stateValue,
                context: context as Record<string, unknown>,
              });
            } catch (error) {
              this.logger.error(`Failed to persist workflow state: ${error}`);
            }
          }

          // Handle completion
          if (snapshot.status === 'done') {
            const result = await this.handleCompletion(
              workflowState.id,
              workflowId,
              stateValue,
              context,
              params,
            );
            resolve(result);
          }
        })();
      });

      // Handle errors in the actor itself
      actor.subscribe({
        error: (error: Error) => {
          void (async () => {
            this.logger.error(
              `Workflow ${workflowId} actor error: ${error.message}`,
            );
            await this.persistenceService.markFailed(
              workflowState.id,
              error.message,
            );
            resolve({
              success: false,
              finalState: 'error',
              context: {} as TContext,
              workflowId,
              error: error.message,
              status: 'failed',
            });
          })();
        },
      });

      // Start the actor
      actor.start();
    });
  }

  /**
   * Handle workflow completion and return the result
   */
  private async handleCompletion<TContext extends object, TInput>(
    persistenceId: string,
    workflowId: string,
    finalState: string,
    context: TContext,
    params: WorkflowExecutionParams<TContext, TInput>,
  ): Promise<WorkflowExecutionResult<TContext>> {
    // Determine if successful based on final state
    // Common patterns: 'completed', 'success', 'done' = success
    // 'failed', 'error', 'failedWithInconsistency' = failure
    // 'compensated', 'cancelled' = specific outcomes

    const successStates = [
      'completed',
      'success',
      'done',
      'sent',
      'paid',
      'accepted',
      'converted',
    ];
    const failedStates = ['failed', 'error', 'failedWithInconsistency'];
    const compensatedStates = ['compensated', 'cancelled', 'voided'];

    let status: WorkflowStatus = 'completed';
    let success = true;
    let error: string | undefined;

    if (failedStates.includes(finalState)) {
      status = 'failed';
      success = false;
      error = (context as { error?: string }).error ?? 'Workflow failed';
      await this.persistenceService.markFailed(persistenceId, error);
      this.logger.error(
        `Workflow ${params.workflowType}:${workflowId} failed in state ${finalState}: ${error}`,
      );
    } else if (compensatedStates.includes(finalState)) {
      status = 'compensated';
      success = true; // Compensation is a valid outcome
      await this.persistenceService.markCompensated(persistenceId);
      this.logger.log(
        `Workflow ${params.workflowType}:${workflowId} compensated in state ${finalState}`,
      );
    } else if (successStates.includes(finalState)) {
      status = 'completed';
      success = true;
      await this.persistenceService.markCompleted(persistenceId);
      this.logger.log(
        `Workflow ${params.workflowType}:${workflowId} completed successfully in state ${finalState}`,
      );
    } else {
      // Unknown final state - treat as completed but log warning
      status = 'completed';
      success = true;
      await this.persistenceService.markCompleted(persistenceId);
      this.logger.warn(
        `Workflow ${params.workflowType}:${workflowId} ended in unknown state ${finalState}`,
      );
    }

    return {
      success,
      finalState,
      context,
      workflowId,
      error,
      status,
    };
  }

  /**
   * Get the state value as a string from a snapshot
   */
  private getStateValue(snapshot: Snapshot<unknown>): string {
    const value = (snapshot as { value?: unknown }).value;
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return 'unknown';
  }

  /**
   * Resume a workflow from persisted state (for recovery)
   */
  async resume<TContext extends Record<string, unknown>>(
    workflowId: string,
  ): Promise<WorkflowExecutionResult<TContext> | null> {
    const workflowState = await this.persistenceService.findById(workflowId);

    if (!workflowState) {
      this.logger.warn(`Workflow ${workflowId} not found for resume`);
      return null;
    }

    if (workflowState.status !== 'running') {
      this.logger.warn(
        `Workflow ${workflowId} is not in running state (status: ${workflowState.status})`,
      );
      return {
        success: workflowState.status === 'completed',
        finalState: workflowState.currentState,
        context: workflowState.context as TContext,
        workflowId,
        status: workflowState.status,
      };
    }

    // For now, log that resume was attempted but not yet implemented
    // Full resume would require storing the machine definition and replaying
    this.logger.warn(
      `Workflow ${workflowId} resume not fully implemented - manual intervention may be required`,
    );

    return {
      success: false,
      finalState: workflowState.currentState,
      context: workflowState.context as TContext,
      workflowId,
      error: 'Workflow resume not fully implemented',
      status: 'running',
    };
  }

  /**
   * Get all workflows that need recovery
   */
  async getRecoverableWorkflows() {
    return this.persistenceService.getRecoverable();
  }

  /**
   * Get workflow statistics
   */
  async getStats() {
    return this.persistenceService.getStats();
  }
}

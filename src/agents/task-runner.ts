/**
 * Agent Task Runner
 * 
 * Executes agent tasks within strict security boundaries.
 * All tasks route through command sandbox for validation.
 * Human operator approval required for non-safe operations.
 * 
 * SSOT: Human Operator
 * Functional role: Task execution within defined parameters only.
 */

import { sandbox, CommandRequest, CommandValidationResult, ApprovalRequest } from '../core/command-sandbox';

export interface Task {
  id: string;
  agentRole: string;
  description: string;
  commands: Array<{ command: string; args: string[] }>;
  status: 'pending' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'blocked';
  createdAt: Date;
  completedAt?: Date;
  results: TaskResult[];
  blockedCommands: string[];
}

export interface TaskResult {
  commandIndex: number;
  success: boolean;
  output?: string;
  error?: string;
  executedAt: Date;
}

export interface TaskRunnerConfig {
  requireApprovalForAll: boolean;
  maxPendingTasks: number;
  autoRejectBlockedTasks: boolean;
}

const DEFAULT_CONFIG: TaskRunnerConfig = {
  requireApprovalForAll: true,
  maxPendingTasks: 10,
  autoRejectBlockedTasks: true,
};

export class TaskRunner {
  private tasks: Map<string, Task>;
  private config: TaskRunnerConfig;
  private approvalCallbacks: Map<string, (approved: boolean) => void>;

  constructor(config: Partial<TaskRunnerConfig> = {}) {
    this.tasks = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.approvalCallbacks = new Map();
  }

  /**
   * Submit a task for validation and potential execution
   * Returns task with status indicating if approval is needed
   */
  submitTask(agentRole: string, description: string, commands: Array<{ command: string; args: string[] }>): Task {
    const taskId = this.generateId();
    const task: Task = {
      id: taskId,
      agentRole,
      description,
      commands,
      status: 'pending',
      createdAt: new Date(),
      results: [],
      blockedCommands: [],
    };

    // Validate all commands first
    const validationResults: CommandValidationResult[] = [];
    let hasBlocked = false;
    let requiresApproval = this.config.requireApprovalForAll;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const request: CommandRequest = {
        id: `${taskId}-cmd-${i}`,
        agentRole,
        command: cmd.command,
        args: cmd.args,
        timestamp: new Date(),
      };

      const result = sandbox.validate(request);
      validationResults.push(result);

      if (result.riskLevel === 'blocked') {
        hasBlocked = true;
        task.blockedCommands.push(`${cmd.command} ${cmd.args.join(' ')}`);
      }

      if (result.requiresApproval) {
        requiresApproval = true;
      }
    }

    // Handle blocked commands
    if (hasBlocked) {
      task.status = 'blocked';
      this.logTaskEvent(task, 'BLOCKED', `Commands blocked: ${task.blockedCommands.join(', ')}`);
      this.tasks.set(taskId, task);
      return task;
    }

    // Request approval if needed
    if (requiresApproval) {
      task.status = 'awaiting_approval';
      this.logTaskEvent(task, 'AWAITING_APPROVAL', 'Task requires human operator approval');
    } else {
      task.status = 'approved';
    }

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Human operator approves a task for execution
   */
  approveTask(taskId: string, operatorName: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'awaiting_approval') {
      return false;
    }

    task.status = 'approved';
    this.logTaskEvent(task, 'APPROVED', `Approved by: ${operatorName}`);

    const callback = this.approvalCallbacks.get(taskId);
    if (callback) {
      callback(true);
      this.approvalCallbacks.delete(taskId);
    }

    return true;
  }

  /**
   * Human operator rejects a task
   */
  rejectTask(taskId: string, reason?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'awaiting_approval') {
      return false;
    }

    task.status = 'failed';
    this.logTaskEvent(task, 'REJECTED', reason || 'Rejected by operator');

    const callback = this.approvalCallbacks.get(taskId);
    if (callback) {
      callback(false);
      this.approvalCallbacks.delete(taskId);
    }

    return true;
  }

  /**
   * Execute an approved task
   * Only runs if task status is 'approved'
   */
  async executeTask(taskId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'approved') {
      throw new Error(`Task ${taskId} is not approved for execution. Current status: ${task.status}`);
    }

    task.status = 'executing';
    this.logTaskEvent(task, 'EXECUTING', 'Task execution started');

    try {
      for (let i = 0; i < task.commands.length; i++) {
        const cmd = task.commands[i];
        const result = await this.executeCommand(cmd.command, cmd.args);
        task.results.push({
          commandIndex: i,
          success: result.success,
          output: result.output,
          error: result.error,
          executedAt: new Date(),
        });

        if (!result.success) {
          task.status = 'failed';
          this.logTaskEvent(task, 'FAILED', `Command ${i} failed: ${result.error}`);
          return task;
        }
      }

      task.status = 'completed';
      task.completedAt = new Date();
      this.logTaskEvent(task, 'COMPLETED', 'All commands executed successfully');
    } catch (error) {
      task.status = 'failed';
      this.logTaskEvent(task, 'ERROR', `Execution error: ${error}`);
    }

    return task;
  }

  /**
   * Wait for approval before executing
   */
  async waitForApproval(taskId: string, timeoutMs: number = 300000): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status === 'approved') return true;
    if (task.status !== 'awaiting_approval') return false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.approvalCallbacks.delete(taskId);
        resolve(false);
      }, timeoutMs);

      this.approvalCallbacks.set(taskId, (approved) => {
        clearTimeout(timeout);
        resolve(approved);
      });
    });
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks awaiting approval
   */
  getPendingApprovals(): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === 'awaiting_approval');
  }

  /**
   * Get full task history
   */
  getTaskHistory(): Task[] {
    return Array.from(this.tasks.values());
  }

  private async executeCommand(command: string, args: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
    // Placeholder for actual command execution
    // In production, this would use child_process or similar
    // with additional sandboxing (containerization, etc.)
    console.log(`[EXECUTE] ${command} ${args.join(' ')}`);
    return { success: true, output: 'Command executed in sandbox' };
  }

  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private logTaskEvent(task: Task, event: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${event}] Task ${task.id} (${task.agentRole}): ${message}`);
  }
}

export const taskRunner = new TaskRunner();

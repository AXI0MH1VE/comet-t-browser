/**
 * Comet-T Browser
 * 
 * Agent security layer ensuring human operator control over all task execution.
 * Models execute functional roles only - no autonomous system-level operations.
 * 
 * SSOT: Human Operator (Alexis M Adams)
 */

export { CommandSandbox, sandbox } from './core/command-sandbox';
export type { CommandRequest, CommandValidationResult, ApprovalRequest } from './core/command-sandbox';

export { TaskRunner, taskRunner } from './agents/task-runner';
export type { Task, TaskResult, TaskRunnerConfig } from './agents/task-runner';

// Example usage
async function main() {
  const { taskRunner } = await import('./agents/task-runner');

  console.log('Comet-T Browser - Agent Security Layer');
  console.log('======================================');
  console.log('Human Operator: SSOT');
  console.log('All agent tasks require validation and approval.\n');

  // Example: Safe command (will be approved automatically if config allows)
  const safeTask = taskRunner.submitTask(
    'file-reader',
    'List directory contents',
    [{ command: 'ls', args: ['-la'] }]
  );
  console.log(`Safe task status: ${safeTask.status}`);

  // Example: Command requiring approval
  const networkTask = taskRunner.submitTask(
    'data-fetcher',
    'Fetch data from API',
    [{ command: 'curl', args: ['https://api.example.com/data'] }]
  );
  console.log(`Network task status: ${networkTask.status}`);

  // Example: Blocked command (system-level)
  const blockedTask = taskRunner.submitTask(
    'cleanup-agent',
    'Remove temporary files',
    [{ command: 'rm', args: ['-rf', '/tmp/*'] }]
  );
  console.log(`Blocked task status: ${blockedTask.status}`);
  console.log(`Blocked commands: ${blockedTask.blockedCommands.join(', ')}`);

  // Show pending approvals
  const pending = taskRunner.getPendingApprovals();
  console.log(`\nPending approvals: ${pending.length}`);
  pending.forEach(t => {
    console.log(`  - ${t.id}: ${t.description}`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

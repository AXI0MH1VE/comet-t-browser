# Comet-T Browser

Agent security layer ensuring human operator control over all task execution.

## Purpose

This system intercepts, validates, and controls all commands that agents attempt to execute. No system-level operations can occur without explicit human approval.

**SSOT**: Human Operator (Alexis M Adams)

## Core Principles

- Models execute functional roles only - no autonomous system operations
- All tasks require validation through the command sandbox
- System-level commands are blocked unconditionally
- Human approval required before execution of non-trivial operations
- Full audit trail of all command requests and approvals

## Architecture

```
src/
├── core/
│   └── command-sandbox.ts    # Command validation and blocking
├── agents/
│   └── task-runner.ts        # Task execution with approval workflow
├── policies/                  # Policy definitions
└── index.ts                  # Main entry point

config/
└── security-policy.json      # Security policy configuration
```

## Blocked Commands

The following categories are **always blocked**:

- **System**: shutdown, reboot, format, diskpart
- **Process**: kill, killall, taskkill
- **Files**: rm, del, dd, shred
- **Permissions**: chmod, chown, icacls
- **Users**: useradd, userdel, passwd
- **Registry**: reg, regedit, sfc, dism
- **Network**: netsh, iptables, firewall-cmd
- **Package managers**: apt, choco, winget, npm install -g
- **Code execution**: eval, exec, bash -c, powershell -c

## Approval Required

These commands require explicit human approval:

- git push, git commit
- npm publish
- docker, kubectl
- ssh, scp, rsync
- curl, wget
- move, copy

## Usage

```typescript
import { taskRunner } from 'comet-t-browser';

// Submit a task for validation
const task = taskRunner.submitTask(
  'agent-role',
  'Task description',
  [{ command: 'ls', args: ['-la'] }]
);

// Check status
if (task.status === 'awaiting_approval') {
  // Human must approve before execution
  taskRunner.approveTask(task.id, 'Operator Name');
}

// Execute approved task
if (task.status === 'approved') {
  await taskRunner.executeTask(task.id);
}
```

## Setup

```bash
npm install
npm run build
npm run dev
```

## Security Model

1. **Validation**: Every command passes through `CommandSandbox.validate()`
2. **Blocking**: System-level commands return `riskLevel: 'blocked'`
3. **Approval**: Non-blocked commands may require human approval
4. **Execution**: Only approved tasks can execute
5. **Audit**: All requests logged for traceability

## License

MIT

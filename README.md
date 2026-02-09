# Comet-T Browser

Agent security layer ensuring human operator control over all task execution.

**SSOT**: Human Operator (Alexis M Adams)

---

## Introduction

The rapid evolution of agentic AI systems—where software agents can autonomously interpret, plan, and execute complex workflows—has fundamentally transformed the web browsing experience. However, this newfound power introduces significant risks: without robust safeguards, agentic browsers can become vectors for privilege escalation, data exfiltration, and loss of human oversight.

The Comet-T Browser project directly addresses these challenges. It is designed to enforce **human control over agent-initiated commands**, ensuring that AI-driven automation remains transparent, auditable, and subject to explicit human approval.

---

## 1. Purpose

This system intercepts, validates, and controls all commands that agents attempt to execute. No system-level operations can occur without explicit human approval.

### Objectives

- **Interpose a validation sandbox** between the agent and the system, ensuring that all potentially dangerous commands are intercepted and subject to policy checks.
- **Require explicit human approval** for sensitive or high-impact actions, preventing agents from executing commands that could compromise security, privacy, or compliance.
- **Maintain a tamper-proof audit trail** of all agent actions, approvals, and denials, supporting transparency, accountability, and regulatory requirements.

---

## 2. Core Principles

### 2.1 The Validation Sandbox

At the heart of Comet-T is the **validation sandbox**—a controlled execution environment that mediates all agent-initiated commands before they reach the underlying system. The sandbox enforces the **principle of least privilege**.

**Key attributes:**
- **Isolation**: Commands are executed in a restricted context
- **Policy enforcement**: Each command is evaluated against `security-policy.json`
- **Compatibility**: Leverages OS-level security features

### 2.2 Command Approval Workflow

1. **Agent proposes a command**
2. **Validation sandbox intercepts** and checks against security policy
3. If **blocked**, command is denied outright
4. If **approval-required**, system prompts the human operator
5. Operator can **approve, deny, or modify** the command
6. All decisions are **logged to the audit trail**

### 2.3 Audit Trail

- Records every agent action, including proposed commands, approvals, and denials
- Captures metadata: timestamp, user identity, command parameters, policy evaluation result
- Ensures immutability through cryptographic protection
- Supports export in standard formats (CSV, PDF)

---

## 3. Architecture

```
+---------------------+
|   Agentic Browser   |
+----------+----------+
           |
           v
+---------------------+
| Validation Sandbox  | <--- security-policy.json
| (command-sandbox.ts)|
+----------+----------+
           |
           v
+---------------------+
| Command Approval UI |
| (human operator)    |
+----------+----------+
           |
           v
+---------------------+
| Task Runner         |
| (task-runner.ts)    |
+----------+----------+
           |
           v
+---------------------+
| System/OS Resources |
+---------------------+
           |
           v
+---------------------+
| Audit Trail & Logs  |
+---------------------+
```

### Directory Structure

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

### Key Components

| Component | Role |
|-----------|------|
| `command-sandbox.ts` | Intercepts commands, evaluates against policy, routes for approval |
| `task-runner.ts` | Orchestrates execution of approved commands, manages task lifecycles |
| `security-policy.json` | Defines blocked categories, approval requirements, runtime checks |

---

## 4. Security Model

### 4.1 Blocked Command Categories

| Category | Example Commands | Rationale |
|----------|------------------|----------|
| File System | `rm -rf /`, `del /s /f` | Prevents data loss, system compromise |
| Network | `curl \| bash`, `netsh` | Blocks data exfiltration, C2 channels |
| Process | `kill`, `taskkill` | Prevents denial of service |
| Privilege Escalation | `sudo`, `runas` | Stops privilege abuse |
| Registry | `reg add`, `regedit` | Prevents persistent compromise |
| Code Execution | `eval`, `exec`, `powershell -c` | Blocks remote code injection |
| Package Managers | `apt`, `choco`, `npm install -g` | Prevents malicious software installation |

### 4.2 Approval-Required Commands

| Category | Example Commands | Use Case |
|----------|------------------|----------|
| Version Control | `git push`, `git commit` | Code deployment |
| Publishing | `npm publish` | Package distribution |
| Containers | `docker`, `kubectl` | Infrastructure management |
| Network | `ssh`, `scp`, `curl`, `wget` | Remote access, data transfer |
| File Operations | `move`, `copy` | File management |

### 4.3 Enforcement Mechanisms

- **Pre-execution validation**: Commands parsed and normalized before policy evaluation
- **Word boundary matching**: Prevents bypass via command concatenation (e.g., "mynpm install -g")
- **Contextual checks**: Evaluates current user, active session, resource state
- **Runtime monitoring**: Terminates tasks exceeding policy-defined limits
- **Immutable logging**: Every action recorded for post-hoc analysis

---

## 5. Threat Model

### Threats Addressed

- **Prompt Injection**: Malicious content embedding hidden instructions
- **Extension/API Abuse**: Undocumented APIs bypassing user consent
- **Privilege Escalation**: Agents exceeding intended scope
- **Data Exfiltration**: Automated leaks via email, network, or file exports
- **Denial of Service**: Resource-intensive tasks overwhelming the system
- **Audit Evasion**: Attempts to erase or tamper with logs

### Mitigation Strategies

- Sandbox isolation limits blast radius
- Policy enforcement reduces exploitation likelihood
- Human-in-the-loop ensures consent for high-impact actions
- Immutable audit trail deters and detects evasion
- Runtime monitoring terminates anomalous behavior

---

## 6. Usage

### Basic Example

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

### Approval Workflow Example

**Scenario**: Agent attempts to send an email.

1. **Agent**: "Send summary to alice@example.com"
2. **Sandbox**: Intercepts, detects as approval-required
3. **UI Prompt**: "Agent requests to send email. Approve?"
4. **Operator**: Reviews content, approves
5. **Task Runner**: Executes the send
6. **Audit Trail**: Logs action, approval, outcome

---

## 7. Setup

```bash
npm install
npm run build
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Run in development mode |
| `npm run test` | Execute tests |
| `npm run lint` | Run linter |

---

## 8. Compliance & Audit

### Regulatory Support

- **21 CFR Part 11**: Electronic records attributable, immutable, auditable
- **GDPR**: Demonstrates control over personal data access/export
- **SOX, HIPAA**: Traces automated actions to human decisions

### Audit Features

- Immutable logs protected against modification
- Exportable in standard formats
- Searchable for rapid incident response
- Evidence of due diligence for regulatory investigations

---

## 9. Applications

- **Agentic AI Systems**: Research automation, email/calendar management
- **Enterprise Automation**: Policy-driven workflows, centralized audit
- **Regulated Environments**: Finance, healthcare, critical infrastructure
- **Developer Tools**: Code analysis, documentation generation, testing

---

## 10. Principles

> "Automation must never come at the expense of human control, security, or accountability."

- **Operator Primacy**: Human operator remains the exclusive locus of authority
- **Explainability**: All agent actions transparent and traceable
- **Functional Roles**: Models execute defined roles, no identity attribution
- **Zero-Entropy**: Outputs minimize logical drift, maintain internal consistency

---

## License

MIT

---

**Author**: Alexis M Adams  
**Repository**: [AXI0MH1VE/comet-t-browser](https://github.com/AXI0MH1VE/comet-t-browser)

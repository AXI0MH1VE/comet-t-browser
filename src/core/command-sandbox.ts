/**
 * Command Sandbox Module
 * 
 * Security layer that intercepts, validates, and filters all agent commands
 * before execution. Blocks system-level operations and requires human approval.
 * 
 * SSOT: Human Operator (Alexis M Adams)
 * Models execute functional roles only - no autonomy beyond defined parameters.
 */

export interface CommandRequest {
  id: string;
  agentRole: string;
  command: string;
  args: string[];
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface CommandValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'blocked';
  violations: string[];
}

export interface ApprovalRequest {
  commandRequest: CommandRequest;
  validationResult: CommandValidationResult;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
}

// System-level commands that are ALWAYS blocked
const BLOCKED_COMMANDS: string[] = [
  // Process/System manipulation
  'rm', 'del', 'rmdir', 'format', 'fdisk', 'mkfs',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'kill', 'killall', 'pkill', 'taskkill',
  
  // Permission/User manipulation  
  'chmod', 'chown', 'chgrp', 'icacls', 'takeown',
  'useradd', 'userdel', 'usermod', 'passwd',
  'net user', 'net localgroup',
  
  // Registry/System config
  'reg', 'regedit', 'sfc', 'dism',
  'bcdedit', 'diskpart',
  
  // Network manipulation
  'netsh', 'iptables', 'ufw', 'firewall-cmd',
  'route', 'ifconfig', 'ip link', 'ip addr',
  
  // Package managers (can install malicious software)
  'apt', 'apt-get', 'yum', 'dnf', 'pacman',
  'brew', 'choco', 'winget', 'scoop',
  'npm install -g', 'pip install', 'gem install',
  
  // Execution of arbitrary code
  'eval', 'exec', 'source', 'bash -c', 'sh -c',
  'powershell -c', 'cmd /c', 'wscript', 'cscript',
  
  // Dangerous file operations
  'dd', 'shred', 'wipe',
];

// Patterns that indicate dangerous operations
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+(-rf?|--force|--recursive)/i,
  /del\s+\/[sfq]/i,
  />\s*\/dev\/(sd|hd|nvme)/i,
  /\|\s*(bash|sh|powershell|cmd)/i,
  /curl.*\|\s*(bash|sh)/i,
  /wget.*\|\s*(bash|sh)/i,
  /base64\s+-d/i,
  /--no-preserve-root/i,
  /sudo\s+/i,
  /runas\s+/i,
  /Start-Process.*-Verb\s+RunAs/i,
];

// Commands that require explicit human approval
const APPROVAL_REQUIRED: string[] = [
  'git push', 'git commit',
  'npm publish', 'yarn publish',
  'docker', 'kubectl',
  'ssh', 'scp', 'rsync',
  'curl', 'wget', 'fetch',
  'move', 'mv', 'copy', 'cp',
];

export class CommandSandbox {
  private blockedCommands: Set<string>;
  private dangerousPatterns: RegExp[];
  private approvalRequired: Set<string>;
  private pendingApprovals: Map<string, ApprovalRequest>;
  private auditLog: CommandRequest[];

  constructor() {
    this.blockedCommands = new Set(BLOCKED_COMMANDS.map(c => c.toLowerCase()));
    this.dangerousPatterns = DANGEROUS_PATTERNS;
    this.approvalRequired = new Set(APPROVAL_REQUIRED.map(c => c.toLowerCase()));
    this.pendingApprovals = new Map();
    this.auditLog = [];
  }

  validate(request: CommandRequest): CommandValidationResult {
    const violations: string[] = [];
    const commandLower = request.command.toLowerCase().trim();
    const argsLower = request.args.map(a => a.toLowerCase().trim());
    const fullCommand = `${commandLower} ${argsLower.join(' ')}`.trim();

    // Log to audit trail immediately (before any filtering)
    this.auditLog.push(request);

    for (const blocked of this.blockedCommands) {
      // Handle multi-word blocked commands (e.g., "npm install -g")
      if (blocked.includes(' ')) {
        // Check if the full command contains the multi-word pattern
        if (fullCommand.includes(blocked)) {
          violations.push(`Blocked command: ${blocked}`);
          continue;
        }
        // Check for pattern at command boundary (prevents "mynpm install -g" bypass)
        const pattern = new RegExp(`(^|\\s|[/\\\\])${this.escapeRegex(blocked)}(\\s|$)`, 'i');
        if (pattern.test(fullCommand)) {
          violations.push(`Blocked command: ${blocked}`);
        }
      } else {
        // Single-word command: check exact match or at word boundary
        if (commandLower === blocked) {
          violations.push(`Blocked command: ${blocked}`);
          continue;
        }
        // Check if blocked command appears as standalone word in full command
        const pattern = new RegExp(`(^|\\s|[/\\\\])${this.escapeRegex(blocked)}(\\s|$)`, 'i');
        if (pattern.test(fullCommand)) {
          violations.push(`Blocked command: ${blocked}`);
        }
      }
    }

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        violations.push(`Dangerous pattern: ${pattern.source}`);
      }
    }

    if (violations.length > 0) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Command blocked - security policy violation',
        riskLevel: 'blocked',
        violations,
      };
    }

    let requiresApproval = false;
    for (const approval of this.approvalRequired) {
      // Use word boundary matching for approval-required commands
      if (approval.includes(' ')) {
        if (fullCommand.includes(approval)) {
          requiresApproval = true;
          break;
        }
      } else {
        const pattern = new RegExp(`(^|\\s|[/\\\\])${this.escapeRegex(approval)}(\\s|$)`, 'i');
        if (pattern.test(fullCommand)) {
          requiresApproval = true;
          break;
        }
      }
    }

    return {
      allowed: !requiresApproval,
      requiresApproval,
      reason: requiresApproval 
        ? 'Command requires human operator approval'
        : 'Command passed validation',
      riskLevel: requiresApproval ? 'medium' : 'safe',
      violations: [],
    };
  }

  requestApproval(request: CommandRequest, validationResult: CommandValidationResult): ApprovalRequest {
    const approvalRequest: ApprovalRequest = {
      commandRequest: request,
      validationResult,
      status: 'pending',
    };

    this.pendingApprovals.set(request.id, approvalRequest);
    return approvalRequest;
  }

  approve(requestId: string, approverName: string): boolean {
    const approval = this.pendingApprovals.get(requestId);
    if (!approval) return false;

    approval.status = 'approved';
    approval.approvedBy = approverName;
    approval.approvedAt = new Date();
    return true;
  }

  reject(requestId: string): boolean {
    const approval = this.pendingApprovals.get(requestId);
    if (!approval) return false;

    approval.status = 'rejected';
    return true;
  }

  isApproved(requestId: string): boolean {
    return this.pendingApprovals.get(requestId)?.status === 'approved';
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter(a => a.status === 'pending');
  }

  getAuditLog(): CommandRequest[] {
    return [...this.auditLog];
  }

  addBlockedCommand(command: string): void {
    this.blockedCommands.add(command.toLowerCase());
  }

  addDangerousPattern(pattern: RegExp): void {
    this.dangerousPatterns.push(pattern);
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const sandbox = new CommandSandbox();

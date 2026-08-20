/**
 *? Usage:
 *    Kiểm tra bảo mật tĩnh: chặn truy cập file nhạy cảm (.env, .pem, credentials...), thư mục hệ thống, và lệnh nguy hiểm (rm -rf, sudo, curl | sh...).
 *
 *? Function:
 *    validatePath()   : Kiểm tra đường dẫn file có an toàn không.
 *    validateCommand(): Kiểm tra lệnh shell có chứa pattern nguy hiểm không.
 */
import * as path from "path";

export interface SecurityResult {
  safe: boolean;
  reason?: string;
}

export class SecurityValidator {
  private static readonly SENSITIVE_PATTERNS = [
    /\.env$/,
    /\.env\..+$/,
    /\.env\.local$/,
    /credentials\.json$/,
    /credentials\.yaml$/,
    /\.pem$/,
    /\.key$/,
    /id_rsa$/,
    /id_ed25519$/,
    /\.ssh\/config$/,
    /\.netrc$/,
    /\.pgpass$/,
    /\.aws\/credentials$/,
    /\.docker\/config\.json$/,
    /secrets\.yaml$/,
    /secrets\.json$/,
    // FIX P1: bổ sung các pattern nhạy cảm còn thiếu
    /\.npmrc$/,
    /\.git-credentials$/,
    /\.htpasswd$/,
    /wp-config\.php$/,
    /settings\.json$/,
  ];

  // FIX P1 Bảo mật: Bổ sung Windows paths
  private static readonly PROTECTED_DIRS = [
    // Linux / macOS
    "/etc",
    "/usr",
    "/sbin",
    "/boot",
    "/sys",
    "/proc",
    "/var/log",
    "/root",
    // Windows
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\System Volume Information",
    "C:\\Users\\All Users",
  ];

  private static readonly DANGEROUS_COMMAND_PATTERNS = [
    { pattern: /;\s*rm\s+-rf\s+\//, label: "rm -rf /" },
    { pattern: /\|\s*sh\b/, label: "pipe to sh" },
    { pattern: /\|\s*bash\b/, label: "pipe to bash" },
    { pattern: /`[^`]+`/, label: "backtick execution" },
    { pattern: />\s*\/etc\//, label: "write to /etc" },
    { pattern: />\s*\/usr\//, label: "write to /usr" },
    { pattern: /curl\s.*\|\s*(bash|sh)/, label: "curl pipe to shell" },
    { pattern: /wget\s.*\|\s*(bash|sh)/, label: "wget pipe to shell" },
    { pattern: /mkfs\./, label: "filesystem format" },
    { pattern: /dd\s+if=.*of=\/dev\//, label: "dd to device" },
    { pattern: /:\(\)\s*\{.*\|.*&\s*\}/, label: "fork bomb" },
    { pattern: /chmod\s+777\s+\//, label: "chmod 777 root" },
    { pattern: />\s*\/dev\/sda/, label: "write to disk device" },
    { pattern: /eval\s+"?\$/, label: "eval variable" },
    // FIX P1: Bổ sung dangerous patterns cho Windows
    { pattern: /\bdel\s+\/[fFsS].*\\Windows/i, label: "del Windows files" },
    { pattern: /\bformat\s+[cCdD]:/i, label: "format drive" },
    { pattern: /\bdiskpart/i, label: "diskpart" },
    { pattern: /\breg\s+delete.*/i, label: "registry delete" },
    { pattern: /\bcmd\s+\/c.*\bdel\b/i, label: "cmd /c del" },
    { pattern: /\bpowershell.*-Command.*Remove-Item/i, label: "powershell remove-item" },
  ];

  private static readonly ELEVATION_PATTERNS = [
    /\bsudo\b/,
    /\bsu\s+-?\s/,
    /\bdoas\b/,
    // FIX: Bổ sung elevation Windows
    /\brunas\b/i,
  ];

  /**
   * Validate a file path for safety.
   */
  public static validatePath(
    filePath: string,
    isWrite: boolean = false,
  ): SecurityResult {
    if (!filePath || filePath.trim().length === 0) {
      return { safe: false, reason: "Empty or invalid path" };
    }

    // Check for null bytes (path injection)
    if (filePath.includes("\0")) {
      return { safe: false, reason: "Null byte in path" };
    }

    const resolved = path.resolve(filePath);
    const basename = path.basename(resolved);

    // Check sensitive file patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(resolved) || pattern.test(basename)) {
        return {
          safe: false,
          reason: `Access to sensitive file blocked for security: ${basename}`,
        };
      }
    }

    // Check protected directories for writes
    // FIX P1: Normalize case + dùng path.sep để hoạt động cross-platform (Windows dùng '\')
    if (isWrite) {
      const normalizedResolved = path.resolve(resolved).toLowerCase();
      for (const dir of this.PROTECTED_DIRS) {
        const normalizedDir = path.resolve(dir).toLowerCase();
        if (
          normalizedResolved === normalizedDir ||
          normalizedResolved.startsWith(normalizedDir + path.sep) ||
          normalizedResolved.startsWith(normalizedDir + "/") ||
          normalizedResolved.startsWith(normalizedDir + "\\")
        ) {
          return {
            safe: false,
            reason: `Writing to protected system directory is blocked: ${dir}`,
          };
        }
      }
    }

    return { safe: true };
  }

  /**
   * Validate a command for safety.
   */
  public static validateCommand(command: string): SecurityResult {
    if (!command || typeof command !== "string") {
      return { safe: false, reason: "Invalid or empty command" };
    }

    // Check dangerous patterns
    for (const { pattern, label } of this.DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command rejected: dangerous pattern detected (${label})`,
        };
      }
    }

    // Check elevated privilege patterns
    for (const pattern of this.ELEVATION_PATTERNS) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason:
            "Command rejected: elevated privilege commands (sudo, su, doas) are blocked",
        };
      }
    }

    return { safe: true };
  }
}
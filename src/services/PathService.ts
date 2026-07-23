import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

/**
 * PathService - Centralized path management service
 * Provides consistent path resolution for project context directories
 */
export class PathService {
  private static instance: PathService;

  private constructor() {}

  public static getInstance(): PathService {
    if (!PathService.instance) {
      PathService.instance = new PathService();
    }
    return PathService.instance;
  }

  /**
   * Get the root context directory for the application
   * @returns Path to ~/.kiro or ~/khanhromvn-zen
   */
  public getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  /**
   * Get the project-specific context directory
   * Creates a unique hash based on workspace folder path
   * @param workspaceFolderPath - Absolute path to workspace folder
   * @returns Path to project context directory (e.g., ~/khanhromvn-zen/projects/{hash})
   */
  public getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  }

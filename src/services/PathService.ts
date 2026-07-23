import * as path from "path";
/**
 *? Usage:
 *    Quản lý đường dẫn tập trung cho thư mục context của dự án.
 *
 *? Function:
 *    getContextRoot()      : Trả về đường dẫn gốc ~/khanhromvn-zen.
 *    getProjectContextDir(): Trả về đường dẫn context cho workspace (dùng hash MD5).
 */

import * as crypto from "crypto";
import * as os from "os";

export class PathService {
  private static instance: PathService;

  private constructor() {}

  public static getInstance(): PathService {
    if (!PathService.instance) {
      PathService.instance = new PathService();
    }
    return PathService.instance;
  }

  public getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  public getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }
}

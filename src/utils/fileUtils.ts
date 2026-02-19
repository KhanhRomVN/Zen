import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, "utf-8");
}

export async function writeFileContent(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.promises.writeFile(filePath, content, "utf-8");
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

export function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".webp",
    ".mp3",
    ".wav",
    ".ogg",
    ".mp4",
    ".webm",
    ".avi",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".rar",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".dat",
  ];
  return binaryExtensions.includes(getFileExtension(filePath));
}

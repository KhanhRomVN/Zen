/**
 * File Extension to Icon Mapper
 * Maps file extensions and filenames to vscode-icons SVG files
 * using vscode-icons-js package
 */
import {
  getIconForFile,
  DEFAULT_FILE,
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_OPENED,
} from "vscode-icons-js";

/**
 * Get icon filename for a given file
 * @param filename - The filename (with or without path)
 * @returns SVG icon filename
 */
export function getFileIcon(filename: string): string {
  // Extract just the filename without path
  const name = filename.split("/").pop() || filename;
  const icon = getIconForFile(name);
  return icon || DEFAULT_FILE;
}

declare global {
  interface Window {
    __zenImagesUri?: string;
  }
}

/**
 * Get full icon path for use in img src
 * @param filename - The filename
 * @returns Full path to icon SVG
 */
export function getFileIconPath(filename: string): string {
  const iconName = getFileIcon(filename);
  const baseUri = window.__zenImagesUri || "/images/icons";
  const path = `${baseUri}/icons/${iconName}`;
  const finalPath = path.replace(/([^:]\/)\/+/g, "$1");
  return finalPath;
}

/**
 * Get folder icon
 * @param isOpen - Whether folder is open
 * @returns SVG icon filename
 */
export function getFolderIcon(isOpen: boolean = false): string {
  return isOpen ? DEFAULT_FOLDER_OPENED : DEFAULT_FOLDER;
}

/**
 * Get full folder icon path
 * @param isOpen - Whether folder is open
 * @returns Full path to folder icon SVG
 */
export function getFolderIconPath(isOpen: boolean = false): string {
  const iconName = getFolderIcon(isOpen);
  const baseUri = window.__zenImagesUri || "/images/icons";
  const path = `${baseUri}/icons/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Get provider icon path
 * @param provider - The provider name (e.g. openai, anthropic, google)
 * @returns Full path to provider icon SVG
 */
export function getProviderIconPath(provider: string): string {
  const normalized = provider.toLowerCase();

  let iconName = "openai.svg"; // Default fallback

  if (normalized.includes("claude") || normalized.includes("anthropic")) {
    iconName = "claude.svg";
  } else if (normalized.includes("gemini") || normalized.includes("google")) {
    iconName = "gemini.svg";
  } else if (normalized.includes("deepseek")) {
    iconName = "deepseek.svg";
  } else if (normalized.includes("grok") || normalized.includes("xai")) {
    iconName = "grok.svg";
  } else if (normalized.includes("openai") || normalized.includes("gpt")) {
    iconName = "openai.svg";
  }

  const baseUri = window.__zenImagesUri || "/images/icons";
  const path = `${baseUri}/provider_icons/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

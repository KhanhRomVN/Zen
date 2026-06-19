import {
  fileNamesMap,
  extensionsMap,
  folderNamesMap,
} from "./materialIconMaps";

/**
 * Get icon filename for a given file
 * @param filename - The filename (with or without path)
 * @returns SVG icon filename
 */
export function getFileIcon(filename: string): string {
  if (!filename) return "file.svg";

  // Clean filename to lowercase and get base name
  const name =
    filename.split("/").pop()?.toLowerCase() || filename.toLowerCase();

  // 1. Check exact filename matches
  if (fileNamesMap[name]) {
    return `${fileNamesMap[name]}.svg`;
  }

  // 2. Check extension matches (longest suffix first, e.g. for .spec.ts, .d.ts)
  const parts = name.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    if (extensionsMap[ext]) {
      return `${extensionsMap[ext]}.svg`;
    }
  }

  // 3. Fallback default file icon
  return "file.svg";
}

/**
 * Get full icon path for use in img src
 * @param filename - The filename
 * @returns Full path to icon SVG
 */
export function getFileIconPath(filename: string): string {
  const iconName = getFileIcon(filename);
  const baseUri = window.__zenImagesUri || "/images";
  const path = `${baseUri}/icons/material/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

/**
 * Get folder icon name
 * Supports two signatures for backward compatibility:
 * 1. getFolderIcon(folderName: string, isOpen: boolean)
 * 2. getFolderIcon(isOpen: boolean)
 */
export function getFolderIcon(
  folderNameOrIsOpen: string | boolean = false,
  isOpenParam: boolean = false,
): string {
  let name = "";
  let isOpen = false;

  if (typeof folderNameOrIsOpen === "string") {
    name =
      folderNameOrIsOpen.split("/").pop()?.toLowerCase() ||
      folderNameOrIsOpen.toLowerCase();
    isOpen = isOpenParam;
  } else {
    isOpen = folderNameOrIsOpen;
  }

  // 1. Check specific folder icon mapping
  if (name && folderNamesMap[name]) {
    const iconName = folderNamesMap[name];
    return isOpen ? `${iconName}-open.svg` : `${iconName}.svg`;
  }

  // 2. Default fallback folder icons
  return isOpen ? "folder-base-open.svg" : "folder-base.svg";
}

/**
 * Get full folder icon path
 * Supports two signatures for backward compatibility:
 * 1. getFolderIconPath(folderName: string, isOpen: boolean)
 * 2. getFolderIconPath(isOpen: boolean)
 */
export function getFolderIconPath(
  folderNameOrIsOpen: string | boolean = false,
  isOpenParam: boolean = false,
): string {
  const iconName = getFolderIcon(folderNameOrIsOpen, isOpenParam);
  const baseUri = window.__zenImagesUri || "/images";
  const path = `${baseUri}/icons/material/${iconName}`;
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

  const baseUri = window.__zenImagesUri || "/images";
  const path = `${baseUri}/icons/material/${iconName}`;
  return path.replace(/([^:]\/)\/+/g, "$1");
}

declare global {
  interface Window {
    __zenImagesUri?: string;
  }
}

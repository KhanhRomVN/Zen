import { extensionService, messageDispatcher } from "./ExtensionService";

export interface ChromeProfileDir {
  label: string;
  path: string;
}

export interface ChromiumProfileEntry {
  folder: string;
  label?: string;
  avatar?: string;
}

function request<T>(
  command: string,
  payload: Record<string, unknown>,
  pick: (msg: any) => T,
  timeoutMessage: string,
): Promise<T> {
  const requestId = `${command}-${Date.now()}`;
  return new Promise<T>((resolve, reject) => {
    messageDispatcher.register(
      requestId,
      (msg: any) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(pick(msg));
      },
      8000,
      () => reject(new Error(timeoutMessage)),
    );
    extensionService.postMessage({ command, requestId, ...payload });
  });
}

export const getChromeProfileDirs = () =>
  request<ChromeProfileDir[]>(
    "getChromeProfileDirs",
    {},
    (msg) => (Array.isArray(msg.dirs) ? msg.dirs : []),
    "Dò thư mục Chrome quá thời gian",
  );

export const listChromiumProfiles = (path: string) =>
  request<{
    folders: string[];
    profiles: ChromiumProfileEntry[];
    is_default_chrome: boolean;
  }>(
    "listChromiumProfiles",
    { path },
    (msg) => ({
      folders: Array.isArray(msg.folders) ? msg.folders : [],
      profiles: Array.isArray(msg.profiles)
        ? msg.profiles.map((p: any) => ({
            folder: p.folder,
            label: p.label,
            avatar: p.avatar,
          }))
        : [],
      is_default_chrome: !!msg.is_default_chrome,
    }),
    "Quét Chromium Profile Folder quá thời gian",
  );
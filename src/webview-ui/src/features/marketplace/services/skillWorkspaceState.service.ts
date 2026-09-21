import {
  messageDispatcher,
  extensionService,
} from "../../../services/ExtensionService";

const REQUEST_TIMEOUT_MS = 10000;

/** Trạng thái tạm của skill marketplace theo workspace. */
export interface SkillWorkspaceState {
  toggles: Record<string, boolean>;
  /** `icon` là tên icon lucide (vd "Folder", "Star") — optional cho state cũ. */
  groups: Array<{ name: string; slugs: string[]; icon?: string }>;
  collapsedGroups: Record<string, boolean>;
}

export const DEFAULT_SKILL_WORKSPACE_STATE: SkillWorkspaceState = {
  toggles: {},
  groups: [],
  collapsedGroups: {},
};

function requestExtension(
  command: "loadSkillWorkspaceState" | "saveSkillWorkspaceState",
  payload: Record<string, any> = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `${command}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    messageDispatcher.register(
      requestId,
      (message: any) => {
        if (message.error) reject(new Error(message.error));
        else resolve(message.data);
      },
      REQUEST_TIMEOUT_MS,
      () =>
        reject(new Error(`${command} timeout after ${REQUEST_TIMEOUT_MS}ms`)),
    );

    extensionService.postMessage({ command, requestId, ...payload });
  });
}

/** Đọc trạng thái skill workspace hiện tại từ extension host. */
export async function loadSkillWorkspaceState(): Promise<SkillWorkspaceState> {
  const data = await requestExtension("loadSkillWorkspaceState");
  if (!data || typeof data !== "object") {
    return DEFAULT_SKILL_WORKSPACE_STATE;
  }
  return {
    toggles: data.toggles ?? {},
    groups: Array.isArray(data.groups) ? data.groups : [],
    collapsedGroups: data.collapsedGroups ?? {},
  };
}

/** Ghi đè toàn bộ trạng thái skill workspace. */
export async function saveSkillWorkspaceState(
  state: SkillWorkspaceState,
): Promise<void> {
  await requestExtension("saveSkillWorkspaceState", { state });
}
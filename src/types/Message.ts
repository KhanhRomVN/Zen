export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  contextSize?: number;
  actionIds?: string[];
  uiHidden?: boolean;
  isCancelled?: boolean;
  thinking?: string;
}
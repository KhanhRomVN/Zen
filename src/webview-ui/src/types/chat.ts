export interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
  conversationId?: string | null;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";
  cookieStoreId?: string;
}

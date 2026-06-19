export interface ChatSession {
  sessionId: number;          // unique identifier for the chat session
  folderPath: string | null;  // workspace folder path
  conversationId?: string | null; // conversation ID for loading history
  canAccept: boolean;         // whether the chat can accept new messages
}

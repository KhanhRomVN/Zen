export interface Checkpoint {
  id: string;
  conversationId: string;
  filePath: string;
  preEditContent: string;
  postEditContent?: string;
  timestamp: number;
  toolType: string;
  isComplete: boolean;
  actionId?: string;
  messageId?: string;
}

/** Core message type representing a single chat turn. */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  token_usage?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** IDs of tool actions that generated this message. */
  actionIds?: string[];
  uiHidden?: boolean;
  isCancelled?: boolean;
  /** Real backend conversation ID for this message. */
  conversationId?: string;
  providerId?: string;
  modelId?: string;
  accountId?: string;
  websiteUrl?: string;
  email?: string;
  isError?: boolean;
  selectedOption?: string;
  thinking?: string;
  clickedActions?: string[];
  rejectedActions?: string[];
  /** DeepSeek parent_message_id for revert support. */
  response_message_id?: string;
}

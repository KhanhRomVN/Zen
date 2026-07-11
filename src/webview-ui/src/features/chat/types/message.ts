export type QuestionType = 'single' | 'multi' | 'text' | 'confirm';

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  options?: string[];
}

export interface QuestionAnswer {
  questionId: string;
  value: string | string[] | boolean;
}

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
  /** Legacy single option selection (kept for backward compatibility) */
  selectedOption?: string;
  /** Structured answers for new paginated question format */
  questionAnswers?: Record<string, QuestionAnswer>;
  thinking?: string;
  clickedActions?: string[];
  rejectedActions?: string[];
  /** DeepSeek parent_message_id for revert support. */
  response_message_id?: string;
}

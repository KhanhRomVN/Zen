import { Message } from "../types/message";

export interface CachedConversation {
  messages: Message[];
  conversationId: string;
  backendConversationId?: string;
  currentModel?: any;
  currentAccount?: any;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  questionAnswers?: Record<string, Record<string, any>>;
  conversationFileStats?: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

const MAX_CACHE = 20;
const cacheKeys: string[] = [];
const cache: Record<string, CachedConversation> = {};

// Global persistent store for questionAnswers (bypasses cache overwrite issues)
const questionAnswersStore: Record<
  string,
  Record<string, Record<string, any>>
> = {};

export const ConversationCache = {
  get: (conversationId: string): CachedConversation | undefined => {
    const result = cache[conversationId];
    // Also check the questionAnswers store
    const qaFromStore = questionAnswersStore[conversationId];
    // If result doesn't have questionAnswers but store does, add it
    if (result && qaFromStore && !result.questionAnswers) {
      result.questionAnswers = qaFromStore;
    }
    return result;
  },
  set: (conversationId: string, data: CachedConversation) => {
    // Always store questionAnswers in the global store
    if (data?.questionAnswers && Object.keys(data.questionAnswers).length > 0) {
      questionAnswersStore[conversationId] = data.questionAnswers;
    }
    if (!cache[conversationId]) {
      if (cacheKeys.length >= MAX_CACHE) {
        const evicted = cacheKeys.shift()!;
        delete cache[evicted];
      }
      cacheKeys.push(conversationId);
    }
    cache[conversationId] = data;
    if (
      cacheKeys.length > 15 ||
      Object.keys(questionAnswersStore).length > 10
    ) {
      console.warn(
        `[ConversationCache] set - key: ${conversationId}, cacheSize: ${cacheKeys.length}, questionStoreSize: ${Object.keys(questionAnswersStore).length}`,
      );
    }
  },
  getQuestionAnswers: (
    conversationId: string,
  ): Record<string, Record<string, any>> | undefined => {
    return questionAnswersStore[conversationId];
  },
  delete: (conversationId: string) => {
    const idx = cacheKeys.indexOf(conversationId);
    if (idx !== -1) cacheKeys.splice(idx, 1);
    delete cache[conversationId];
  },
  clear: () => {
    cacheKeys.length = 0;
    Object.keys(cache).forEach((k) => delete cache[k]);
  },
};

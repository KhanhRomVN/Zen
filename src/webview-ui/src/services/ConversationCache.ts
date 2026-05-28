import { Message } from "../components/ChatPanel/ChatBody/types";

export interface CachedConversation {
  messages: Message[];
  conversationId: string;
  backendConversationId?: string;
  currentModel?: any;
  currentAccount?: any;
}

const MAX_CACHE = 20;
const cacheKeys: string[] = [];
const cache: Record<string, CachedConversation> = {};

export const ConversationCache = {
  get: (conversationId: string): CachedConversation | undefined => cache[conversationId],
  set: (conversationId: string, data: CachedConversation) => {
    if (!cache[conversationId]) {
      if (cacheKeys.length >= MAX_CACHE) {
        const evicted = cacheKeys.shift()!;
        delete cache[evicted];
      }
      cacheKeys.push(conversationId);
    }
    cache[conversationId] = data;
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

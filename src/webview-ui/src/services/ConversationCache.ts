import { Message } from "../components/ChatPanel/ChatBody/types";

export interface CachedConversation {
  messages: Message[];
  conversationId: string;
  backendConversationId?: string;
  currentModel?: any;
  currentAccount?: any;
}

const cache: Record<string, CachedConversation> = {};

export const ConversationCache = {
  get: (conversationId: string): CachedConversation | undefined => {
    return cache[conversationId];
  },
  set: (conversationId: string, data: CachedConversation) => {
    cache[conversationId] = data;
  },
  delete: (conversationId: string) => {
    delete cache[conversationId];
  },
  clear: () => {
    Object.keys(cache).forEach((key) => {
      delete cache[key];
    });
  },
};

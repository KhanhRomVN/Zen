import { useRef } from "react";
import { Message } from "../../types/message";

export const useConversationRefs = () => {
  const messagesRef = useRef<Message[]>([]);
  const currentConversationIdRef = useRef<string>("");
  const backendConversationIdRef = useRef<string>("");
  const lastUsedModelRef = useRef<any>(null);
  const lastUsedAccountRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const qwenParentIdRef = useRef<string | undefined>(undefined);
  const userRequestCountRef = useRef<number>(0);
  const renderCountRef = useRef(0);
  const prevDepsRef = useRef<any>({});

  return {
    messagesRef,
    currentConversationIdRef,
    backendConversationIdRef,
    lastUsedModelRef,
    lastUsedAccountRef,
    abortControllerRef,
    qwenParentIdRef,
    userRequestCountRef,
    renderCountRef,
    prevDepsRef,
  };
};

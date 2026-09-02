export interface ConversationTitleParams {
  title: string;
}

export const parseConversationTitle = (
  innerContent: string,
): ConversationTitleParams => {
  return {
    title: innerContent.trim(),
  };
};
/**
 * Parser for <context_compression> blocks (normalized from <conversation_compress>)
 */
export interface ContextCompressionParams {
  summary: string;
}

export const parseContextCompression = (
  content: string,
): ContextCompressionParams | null => {
  // After normalization, the tag is <context_compression>
  const regex = /<context_compression>([\s\S]*?)<\/context_compression>/i;
  const match = content.match(regex);

  if (!match) return null;

  const summary = match[1].trim();

  return {
    summary,
  };
};

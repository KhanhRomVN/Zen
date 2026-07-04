/**
 * Parser for <context_compression> blocks
 */
export interface ContextCompressionParams {
  summary: string;
}

export const parseContextCompression = (
  content: string,
): ContextCompressionParams | null => {
  const regex = /<context_compression>([\s\S]*?)<\/context_compression>/i;
  const match = content.match(regex);

  if (!match) return null;

  const summary = match[1].trim();

  return {
    summary,
  };
};

export const getFaviconUrl = (website: string): string => {
  if (!website) return "";
  try {
    const url = new URL(website);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
};
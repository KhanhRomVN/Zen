export interface FindFilesParams {
  file_names: string[];
}

export function parseFindFiles(content: string): FindFilesParams {
  const fileNames: string[] = [];
  
  // Match all <file_name>...</file_name> tags
  const fileNameRegex = /<file_name>(.*?)<\/file_name>/gs;
  let match;
  
  while ((match = fileNameRegex.exec(content)) !== null) {
    const fileName = match[1].trim();
    if (fileName) {
      fileNames.push(fileName);
    }
  }
  
  return {
    file_names: fileNames,
  };
}

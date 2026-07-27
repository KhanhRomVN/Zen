export interface FindFilesParams {
  file_name: string;
  folder_path?: string;
}

export function parseFindFiles(content: string): FindFilesParams {
  // Match <file_name>...</file_name> tag (single file name only)
  const fileNameMatch = /<file_name>(.*?)<\/file_name>/s.exec(content);
  const fileName = fileNameMatch ? fileNameMatch[1].trim() : "";
  
  // Match optional <folder_path>...</folder_path> tag
  const folderPathMatch = /<folder_path>(.*?)<\/folder_path>/s.exec(content);
  const folderPath = folderPathMatch ? folderPathMatch[1].trim() : undefined;
  
  return {
    file_name: fileName,
    folder_path: folderPath,
  };
}

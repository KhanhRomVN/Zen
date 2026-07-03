import { extractParamValue } from "../../utils/ToolParser";

export interface ListFilesParams {
  folder_path: string;
  type?: string;
}

export const parseListFiles = (innerContent: string): ListFilesParams => {
  const folderPath = extractParamValue(innerContent, "folder_path");
  const type = extractParamValue(innerContent, "type");

  return {
    folder_path: folderPath || "",
    type: type || undefined,
  };
};

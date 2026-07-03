import { useCallback } from "react";

/**
 * Hook that provides a function to upload local files to the backend
 * and return their file_ids for use in chat requests.
 */
export const useFileUpload = (apiUrl: string) => {
  /**
   * Uploads an array of file objects to the backend.
   * Files that already have a `file_id` are passed through as-is.
   * Returns a list of file_ids to include in the API request.
   */
  const uploadFiles = useCallback(
    async (files: any[], accountId: string): Promise<string[]> => {
      const ref_file_ids: string[] = [];

      const localFiles = files.filter(
        (f: any) =>
          !f.id?.startsWith("attached-") &&
          !f.id?.startsWith("rule-") &&
          !f.id?.startsWith("terminal-"),
      );

      for (const file of localFiles) {
        // Already uploaded — reuse existing file_id
        if (file.file_id) {
          ref_file_ids.push(file.file_id);
          continue;
        }

        try {
          let blob: Blob;
          if (file.content.startsWith("data:")) {
            const arr = file.content.split(",");
            const mime =
              arr[0].match(/:(.*?);/)?.[1] ||
              file.type ||
              "application/octet-stream";
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
          } else {
            blob = new Blob([file.content], {
              type: file.type || "text/plain",
            });
          }

          const formData = new FormData();
          formData.append("file", blob, file.name);

          const uploadRes = await fetch(
            `${apiUrl}/v1/chat/accounts/${accountId}/uploads`,
            { method: "POST", body: formData },
          );

          if (!uploadRes.ok) {
            throw new Error(`Upload API returned status ${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.data?.file_id) {
            ref_file_ids.push(uploadData.data.file_id);
          } else {
            throw new Error(uploadData.error || "Unknown upload error");
          }
        } catch (err) {
          throw new Error(
            `Failed to upload ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return ref_file_ids;
    },
    [apiUrl],
  );

  return { uploadFiles };
};

import { useCallback } from "react";

/**
 * Hook that provides a function to upload local files to the backend
 * and return their file objects for use in chat requests.
 */
export const useFileUpload = (apiUrl: string) => {
  /**
   * Uploads an array of file objects to the backend.
   * Files that already have a `file_id` are passed through as-is.
   * Returns a list of file objects to include in the API request.
   */
  const uploadFiles = useCallback(
    async (files: any[], accountId: string): Promise<Array<{ file_id: string; url: string; type?: string; name?: string; file_type?: string }>> => {
      
      const ref_file_ids: Array<{ file_id: string; url: string; type?: string; name?: string; file_type?: string }> = [];

      const localFiles = files.filter(
        (f: any) =>
          !f.id?.startsWith("attached-") &&
          !f.id?.startsWith("rule-") &&
          !f.id?.startsWith("terminal-") &&
          !f.id?.startsWith("snippet-") && // 🚀 FIX: Don't upload text snippets
          !f.id?.startsWith("external-"), // 🚀 FIX: Don't upload external files (content already in them)
      );

      for (const file of localFiles) {        
        // Already uploaded — reuse existing file_id with url if available
        if (file.file_id) {
          ref_file_ids.push({
            file_id: file.file_id,
            url: file.url || '',
            type: file.type?.startsWith('image/') ? 'image' : 'file',
            name: file.name,
            file_type: file.type
          });
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

          const uploadUrl = `${apiUrl}/v1/uploads/accounts/${accountId}/uploads`;

          const uploadRes = await fetch(uploadUrl, { 
            method: "POST", 
            body: formData 
          });


          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error(`[Zen Upload] Upload failed | name=${file.name} | status=${uploadRes.status} | error=${errorText}`);
            throw new Error(`Upload API returned status ${uploadRes.status}: ${errorText}`);
          }

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.data?.file_id && uploadData.data?.url) {
            // Push object with file_id AND url
            ref_file_ids.push({
              file_id: uploadData.data.file_id,
              url: uploadData.data.url,
              type: file.type?.startsWith('image/') ? 'image' : 'file',
              name: uploadData.data.filename || file.name,
              file_type: file.type
            });
          } else {
            const error = uploadData.error || "Upload response missing file_id or url";
            console.error(`[Zen Upload] Upload response invalid | name=${file.name} | error=${error}`);
            throw new Error(error);
          }
        } catch (err) {
          const errorMsg = `Failed to upload ${file.name}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[Zen Upload] Upload exception | name=${file.name}`, err);
          console.error(`[Zen Upload] Error stack | name=${file.name}`, err instanceof Error ? err.stack : 'No stack trace');
          throw new Error(errorMsg);
        }
      }

      return ref_file_ids;
    },
    [apiUrl],
  );

  return { uploadFiles };
};

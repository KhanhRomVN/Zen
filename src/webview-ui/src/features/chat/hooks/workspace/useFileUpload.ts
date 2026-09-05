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
      console.log(`[Zen Upload] Starting upload | totalFiles=${files.length} | accountId=${accountId}`);
      
      const ref_file_ids: string[] = [];

      const localFiles = files.filter(
        (f: any) =>
          !f.id?.startsWith("attached-") &&
          !f.id?.startsWith("rule-") &&
          !f.id?.startsWith("terminal-") &&
          !f.id?.startsWith("snippet-") && // 🚀 FIX: Don't upload text snippets
          !f.id?.startsWith("external-"), // 🚀 FIX: Don't upload external files (content already in them)
      );

      console.log(`[Zen Upload] Filtered files | localFiles=${localFiles.length} | skipped=${files.length - localFiles.length}`);

      for (const file of localFiles) {
        console.log(`[Zen Upload] Processing file | name=${file.name} | type=${file.type} | hasFileId=${!!file.file_id} | contentLength=${file.content?.length}`);
        
        // Already uploaded — reuse existing file_id
        if (file.file_id) {
          console.log(`[Zen Upload] Reusing existing file_id | name=${file.name} | file_id=${file.file_id}`);
          ref_file_ids.push(file.file_id);
          continue;
        }

        try {
          let blob: Blob;
          if (file.content.startsWith("data:")) {
            console.log(`[Zen Upload] Converting data URL to blob | name=${file.name}`);
            const arr = file.content.split(",");
            const mime =
              arr[0].match(/:(.*?);/)?.[1] ||
              file.type ||
              "application/octet-stream";
            console.log(`[Zen Upload] Detected MIME type | name=${file.name} | mime=${mime}`);
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
            console.log(`[Zen Upload] Blob created from data URL | name=${file.name} | size=${blob.size}`);
          } else {
            console.log(`[Zen Upload] Creating blob from content | name=${file.name}`);
            blob = new Blob([file.content], {
              type: file.type || "text/plain",
            });
            console.log(`[Zen Upload] Blob created from content | name=${file.name} | size=${blob.size}`);
          }

          const formData = new FormData();
          formData.append("file", blob, file.name);

          const uploadUrl = `${apiUrl}/v1/uploads/accounts/${accountId}/uploads`;
          console.log(`[Zen Upload] Sending upload request | name=${file.name} | url=${uploadUrl} | blobSize=${blob.size}`);

          const uploadRes = await fetch(uploadUrl, { 
            method: "POST", 
            body: formData 
          });

          console.log(`[Zen Upload] Upload response received | name=${file.name} | status=${uploadRes.status} | ok=${uploadRes.ok}`);

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error(`[Zen Upload] Upload failed | name=${file.name} | status=${uploadRes.status} | error=${errorText}`);
            throw new Error(`Upload API returned status ${uploadRes.status}: ${errorText}`);
          }

          const uploadData = await uploadRes.json();
          console.log(`[Zen Upload] Response parsed | name=${file.name} | success=${uploadData.success} | hasFileId=${!!uploadData.data?.file_id}`);
          console.log(`[Zen Upload] Full response data | name=${file.name} | data=${JSON.stringify(uploadData)}`);

          if (uploadData.success && uploadData.data?.file_id) {
            console.log(`[Zen Upload] Upload successful | name=${file.name} | file_id=${uploadData.data.file_id}`);
            ref_file_ids.push(uploadData.data.file_id);
          } else {
            const error = uploadData.error || "Unknown upload error";
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

      console.log(`[Zen Upload] All uploads completed | totalFileIds=${ref_file_ids.length} | file_ids=${JSON.stringify(ref_file_ids)}`);
      return ref_file_ids;
    },
    [apiUrl],
  );

  return { uploadFiles };
};

import React, { useState } from "react";
import { FileIcon as FileIconLucide, Terminal, Loader2 } from "lucide-react";
import FileIcon from "@/icons/FileIcon";
import TextSnippetDrawer from "./TextSnippetDrawer";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or text content
  file_id?: string;
  isUploading?: boolean;
  error?: string;
}

interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "folder" | "external" | "text-snippet";
  content?: string; // For text-snippet type
  lineCount?: number; // For text-snippet type
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

interface FilesPreviewsProps {
  uploadedFiles: UploadedFile[];
  attachedItems: AttachedItem[];
  onRemoveFile: (id: string) => void;
  onRemoveAttachedItem: (id: string) => void;
  onOpenImage: (file: UploadedFile) => void;
  onAttachedItemClick: (item: AttachedItem) => void;
  readOnly?: boolean; // Add read-only mode for display in messages
}

const FilesPreviews: React.FC<FilesPreviewsProps> = ({
  uploadedFiles,
  attachedItems,
  onRemoveFile,
  onRemoveAttachedItem,
  onOpenImage,
  onAttachedItemClick,
  readOnly = false,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState("");
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerSnippetNumber, setDrawerSnippetNumber] = useState<number | undefined>(undefined);
  const [drawerLineCount, setDrawerLineCount] = useState<number | undefined>(undefined);

  const handleTextSnippetClick = (item: AttachedItem, index: number) => {
    setDrawerTitle(item.path);
    setDrawerContent(item.content || "");
    setDrawerSnippetNumber(index + 1); // 1-based index
    setDrawerLineCount(item.lineCount);
    setDrawerOpen(true);
    // Also call the original callback
    onAttachedItemClick(item);
  };

  return (
    <>
      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div
          style={{
            padding: readOnly 
              ? "var(--spacing-sm) 0" 
              : "var(--spacing-sm) var(--spacing-lg)",
            borderTop: readOnly 
              ? "none" 
              : "1px solid var(--border-color)",
            backgroundColor: "var(--secondary-bg)",
          }}
        >
          {/* Images Row */}
          {uploadedFiles.filter((file) => file.type.startsWith("image/"))
            .length > 0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Images:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  gap: "var(--spacing-xs)",
                  maxHeight: "80px",
                }}
              >
                {uploadedFiles
                  .filter((file) => file.type.startsWith("image/"))
                  .map((file) => {
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          const vscodeApi = (window as any).vscodeApi;
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "openTempImage",
                              content: file.content,
                              filename: file.name,
                            });
                          } else {
                            console.warn(
                              "[FilesPreviews] vscodeApi not available!",
                            );
                          }
                          onOpenImage(file);
                        }}
                        style={{
                          position: "relative",
                          width: "40px",
                          height: "40px",
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={file.content}
                          alt={file.name}
                          title={file.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "var(--border-radius)",
                            border: file.error
                              ? "1px solid var(--vscode-errorForeground, #f44336)"
                              : "1px solid var(--border-color)",
                            opacity: file.isUploading ? 0.5 : 1,
                            filter: file.isUploading ? "blur(0.5px)" : "none",
                            pointerEvents: "none",
                          }}
                        />
                        {file.isUploading && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(0, 0, 0, 0.4)",
                              borderRadius: "var(--border-radius)",
                              pointerEvents: "none",
                            }}
                          >
                            <Loader2
                              size={16}
                              color="var(--vscode-editor-foreground, #ffffff)"
                              className="spin-animation"
                            />
                          </div>
                        )}
                        {file.error && (
                          <div
                            title={file.error}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(244, 67, 54, 0.6)",
                              borderRadius: "var(--border-radius)",
                              color: "var(--vscode-editor-foreground, #fff)",
                              fontSize: "12px",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            ⚠️
                          </div>
                        )}
                        {!readOnly && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFile(file.id);
                            }}
                            style={{
                              position: "absolute",
                              top: "-4px",
                              right: "-4px",
                              width: "14px",
                              height: "14px",
                              borderRadius: "50%",
                              backgroundColor: "var(--secondary-bg)",
                              border: "1px solid var(--border-color)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              zIndex: 10,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          >
                            <svg
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Non-image Files Row */}
          {uploadedFiles.filter((file) => !file.type.startsWith("image/"))
            .length > 0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Files:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {uploadedFiles
                  .filter((file) => !file.type.startsWith("image/"))
                  .map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "transparent",
                        border: file.error
                          ? "1px solid var(--vscode-errorForeground, #f44336)"
                          : "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: file.error
                          ? "var(--vscode-errorForeground, #f44336)"
                          : "var(--primary-text)",
                        opacity: file.isUploading ? 0.6 : 1,
                      }}
                    >
                      <span>📎</span>
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={file.error || file.name}
                      >
                        {file.name}
                      </span>
                      <span style={{ color: "var(--secondary-text)" }}>
                        ({formatFileSize(file.size)})
                      </span>
                      {file.isUploading && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--secondary-text)",
                          }}
                        >
                          (uploading...)
                        </span>
                      )}
                      {file.error && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--vscode-errorForeground, #f44336)",
                          }}
                          title={file.error}
                        >
                          ⚠️
                        </span>
                      )}
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={() => onRemoveFile(file.id)}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attached Items Display Area (Files/Folders from @ mention) */}
      {attachedItems.length > 0 && (
        <div
          style={{
            padding: readOnly 
              ? "var(--spacing-sm) 0" 
              : "var(--spacing-sm) var(--spacing-lg)",
            borderTop: readOnly 
              ? "none"
              : (uploadedFiles.length === 0
                  ? "1px solid var(--border-color)"
                  : "none"),
            backgroundColor: "var(--secondary-bg)",
          }}
        >
          {/* Files Row */}
          {attachedItems.filter((item) => item.type === "file").length > 0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Files:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {attachedItems
                  .filter((item) => item.type === "file")
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => onAttachedItemClick(item)}
                      title={`Click to open: ${item.path}`}
                    >
                      <FileIconLucide
                        path={item.path}
                        style={{ width: "14px", height: "14px" }}
                      />
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.path.split("/").pop()}
                      </span>
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAttachedItem(item.id);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Folders Row */}
          {attachedItems.filter((item) => item.type === "folder").length >
            0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Folders:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {attachedItems
                  .filter((item) => item.type === "folder")
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => onAttachedItemClick(item)}
                      title={item.path}
                    >
                      <FileIcon
                        path={item.path}
                        isFolder={true}
                        style={{ width: "14px", height: "14px" }}
                      />
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.path.split("/").pop() || item.path}
                      </span>
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAttachedItem(item.id);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* External Files Row */}
          {attachedItems.filter((item) => item.type === "external").length >
            0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                External Files:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {attachedItems
                  .filter((item) => item.type === "external")
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => onAttachedItemClick(item)}
                      title={`External file: ${item.path}`}
                    >
                      <FileIcon
                        path={item.path}
                        style={{ width: "14px", height: "14px" }}
                      />
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.path.split("/").pop() ||
                          item.path.split("\\").pop() ||
                          item.path}
                      </span>
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAttachedItem(item.id);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Terminals Row */}
          {attachedItems.filter((item) => item.type === ("terminal" as any))
            .length > 0 && (
            <div
              style={{
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Terminals:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {attachedItems
                  .filter((item) => item.type === ("terminal" as any))
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--secondary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => onAttachedItemClick(item)}
                      title={`Terminal ID: ${item.path}`}
                    >
                      <Terminal size={14} />
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.path}
                      </span>
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAttachedItem(item.id);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Text Snippets Row */}
          {attachedItems.filter((item) => item.type === "text-snippet").length >
            0 && (
            <div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  marginBottom: "var(--spacing-xs)",
                }}
              >
                Text Snippets:
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--spacing-xs)",
                }}
              >
                {attachedItems
                  .filter((item) => item.type === "text-snippet")
                  .map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        backgroundColor:
                          "var(--vscode-editor-background, rgba(128, 128, 128, 0.1))",
                        border:
                          "1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => handleTextSnippetClick(item, index)}
                      title={`Large text snippet: ${item.content?.substring(0, 100)}...`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <line x1="10" y1="9" x2="8" y2="9" />
                      </svg>
                      <span
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Snippet[{index + 1}] ({item.lineCount || 0} lines)
                      </span>
                      {!readOnly && (
                        <div
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAttachedItem(item.id);
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Snippet Drawer */}
      <TextSnippetDrawer
        isOpen={drawerOpen}
        content={drawerContent}
        title={drawerTitle}
        snippetNumber={drawerSnippetNumber}
        lineCount={drawerLineCount}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default FilesPreviews;

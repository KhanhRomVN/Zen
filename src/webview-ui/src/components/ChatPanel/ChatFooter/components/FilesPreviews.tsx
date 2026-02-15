import React from "react";
import { UploadedFile, AttachedItem } from "../types";
import { formatFileSize } from "../utils";
import FileIcon from "../../../common/FileIcon";

interface FilesPreviewsProps {
  uploadedFiles: UploadedFile[];
  attachedItems: AttachedItem[];
  onRemoveFile: (id: string) => void;
  onRemoveAttachedItem: (id: string) => void;
  onOpenImage: (file: UploadedFile) => void;
  onAttachedItemClick: (item: AttachedItem) => void;
}

const FilesPreviews: React.FC<FilesPreviewsProps> = ({
  uploadedFiles,
  attachedItems,
  onRemoveFile,
  onRemoveAttachedItem,
  onOpenImage,
  onAttachedItemClick,
}) => {
  return (
    <>
      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div
          style={{
            padding: "var(--spacing-sm) var(--spacing-lg)",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--primary-bg)",
            display: "flex",
            flexWrap: "nowrap",
            overflowX: "auto",
            gap: "var(--spacing-xs)",
            maxHeight: "80px",
          }}
        >
          {uploadedFiles.map((file) => {
            const isImage = file.type.startsWith("image/");
            if (isImage) {
              return (
                <div
                  key={file.id}
                  style={{
                    position: "relative",
                    width: "40px",
                    height: "40px",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={file.content}
                    alt={file.name}
                    title={file.name}
                    onClick={() => onOpenImage(file)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      border: "1px solid var(--border-color)",
                    }}
                  />
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
                </div>
              );
            }

            return (
              <div
                key={file.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-xs)",
                  padding: "var(--spacing-xs) var(--spacing-sm)",
                  backgroundColor: "var(--secondary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--primary-text)",
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
                  title={file.name}
                >
                  {file.name}
                </span>
                <span style={{ color: "var(--secondary-text)" }}>
                  ({formatFileSize(file.size)})
                </span>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Attached Items Display Area (Files/Folders from @ mention) */}
      {attachedItems.length > 0 && (
        <div
          style={{
            padding: "var(--spacing-sm) var(--spacing-lg)",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--primary-bg)",
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
                        backgroundColor: "var(--secondary-bg)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                        cursor: "pointer",
                      }}
                      onClick={() => onAttachedItemClick(item)}
                      title={`Click to open: ${item.path}`}
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
                        {item.path.split("/").pop()}
                      </span>
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
                        backgroundColor: "var(--secondary-bg)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                      }}
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
                        backgroundColor: "var(--secondary-bg)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                      }}
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
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FilesPreviews;

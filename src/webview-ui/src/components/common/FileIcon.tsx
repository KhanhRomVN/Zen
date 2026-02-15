import React, { useState, useEffect } from "react";
import { getFileIconPath, getFolderIconPath } from "../../utils/fileIconMapper";

interface FileIconProps {
  path: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const FileIcon: React.FC<FileIconProps> = ({
  path,
  isFolder = false,
  isOpen = false,
  className,
  style,
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state when props change
  useEffect(() => {
    setHasError(false);
  }, [path, isFolder, isOpen]);

  const getTargetSrc = () => {
    if (isFolder) {
      return getFolderIconPath(isOpen);
    }
    return getFileIconPath(path);
  };

  const getFallbackSrc = () => {
    if (isFolder) {
      return getFolderIconPath(false);
    }
    return getFileIconPath("default_file");
  };

  const src = hasError ? getFallbackSrc() : getTargetSrc();

  const handleError = () => {
    if (!hasError) {
      console.warn(
        `[FileIcon] Failed to load icon: ${src} for path: ${path}. Switching to fallback.`
      );
      setHasError(true);
    }
  };

  return (
    <img
      src={src}
      alt={isFolder ? "folder" : "file"}
      className={className}
      style={style}
      onError={handleError}
    />
  );
};

export default FileIcon;

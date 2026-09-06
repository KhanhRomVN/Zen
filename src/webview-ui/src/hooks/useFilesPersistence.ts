import { useState, useEffect, useRef } from "react";
import { extensionService } from "../services/ExtensionService";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  file_id?: string;
  isUploading?: boolean;
  error?: string;
}

interface AttachedItem {
  id: string;
  path: string;
  type: "file" | "external" | "text-snippet";
  content?: string;
  lineCount?: number;
}

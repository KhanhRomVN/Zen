import type { FileMutationTool } from "@/features/chat/constants/constants";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or text content
  file_id?: string;
  isUploading?: boolean;
  error?: string;
}

export interface MessageInputProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  isHistoryMode?: boolean;
  uploadedFiles: UploadedFile[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  onOpenProjectStructure: () => void;
  showChangesDropdown: boolean;
  setShowChangesDropdown: (show: boolean) => void;
  messages: any[];
  handleSend: (model: any, account: any) => void;
  hasProjectContext: boolean;
  onOpenProjectContext: () => void;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  isProcessing?: boolean;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  showBrowserWarning?: boolean;
  isLaunchingBrowser?: boolean;
  onLaunchBrowserSession?: () => void;
  onGitPullRequest?: () => void;
  isGitLoading?: boolean;
  isGitStatusVisible?: boolean;
  gitStatus?: { items?: any[]; branch?: string } | null;
  onOpenGitStatus?: () => void;
  conversationFileStats?: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    responseNumber?: number;
  };
  onReviewClick?: () => void;
  responseRange?: { start: number; end: number } | null;
  responseRanges?: Array<{
    start: number;
    end: number;
    isCurrent: boolean;
    fileChanges: Map<
      string,
      {
        additions: number;
        deletions: number;
        toolType?: FileMutationTool;
        content?: string;
        oldContent?: string;
        newContent?: string;
      }
    >;
  }>;
  onModelSwitch?: (
    newModel: any,
    newAccount: any,
    contextData: {
      fileChanges: Array<{
        path: string;
        additions: number;
        deletions: number;
      }>;
      userMessages: Array<{ content: string; responseNumber: number }>;
    },
  ) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  autoScrollPaused?: boolean;
  scrollToBottom?: () => void;
}export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 or text content
  file_id?: string;
  isUploading?: boolean;
  error?: string;
}

export interface MessageInputProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  isHistoryMode?: boolean;
  uploadedFiles: UploadedFile[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  onOpenProjectStructure: () => void;
  showChangesDropdown: boolean;
  setShowChangesDropdown: (show: boolean) => void;
  messages: any[];
  handleSend: (model: any, account: any) => void;
  hasProjectContext: boolean;
  onOpenProjectContext: () => void;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  isProcessing?: boolean;
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  showBrowserWarning?: boolean;
  isLaunchingBrowser?: boolean;
  onLaunchBrowserSession?: () => void;
  onGitPullRequest?: () => void;
  isGitLoading?: boolean;
  isGitStatusVisible?: boolean;
  gitStatus?: { items?: any[]; branch?: string } | null;
  onOpenGitStatus?: () => void;
  conversationFileStats?: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    responseNumber?: number;
  };
  onReviewClick?: () => void;
  responseRange?: { start: number; end: number } | null;
  responseRanges?: Array<{
    start: number;
    end: number;
    isCurrent: boolean;
    fileChanges: Map<
      string,
      {
        additions: number;
        deletions: number;
        toolType?: "write_to_file" | "replace_in_file" | "revert_file";
        content?: string;
        oldContent?: string;
        newContent?: string;
      }
    >;
  }>;
  onModelSwitch?: (
    newModel: any,
    newAccount: any,
    contextData: {
      fileChanges: Array<{
        path: string;
        additions: number;
        deletions: number;
      }>;
      userMessages: Array<{ content: string; responseNumber: number }>;
    },
  ) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  autoScrollPaused?: boolean;
  scrollToBottom?: () => void;
}

export interface ToggleButtonProps {
  isOn: boolean;
  onClick: () => void;
  title: string;
}

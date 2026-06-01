# Requirements Document

## Introduction

Tính năng **File Content Snapshot & Inline Diff Viewer** cho phép Zen lưu lại nội dung file tại thời điểm mỗi lần tool `write_to_file` hoặc `replace_in_file` được thực thi, sau đó hiển thị nội dung đó trực tiếp trong conversation UI khi người dùng click vào label **CREATE** hoặc **UPDATE** của tool item. Thay vì chỉ focus vào file trong editor như hiện tại, người dùng có thể xem toàn bộ nội dung file đã ghi (với `write_to_file`) hoặc xem diff trước/sau (với `replace_in_file`) ngay trong panel chat mà không cần rời khỏi conversation.

## Glossary

- **Snapshot_Manager**: Module phía extension host chịu trách nhiệm lưu nội dung file vào thư mục `conv` sau mỗi lần tool ghi file được thực thi thành công.
- **Conv_Folder**: Thư mục lưu trữ dữ liệu conversation tại `~/khanhromvn-zen/projects/<hash>/<conversationId>/`. Đây là nơi `CheckpointManager` đã lưu checkpoint; snapshot sẽ được lưu trong thư mục con `snapshots/` bên trong.
- **Snapshot**: Bản ghi nội dung file tại một thời điểm cụ thể, bao gồm: đường dẫn file, nội dung sau khi ghi, nội dung trước khi ghi (nếu có), loại thao tác (`write` hoặc `replace`), và timestamp.
- **Snapshot_File**: File JSON lưu trữ một Snapshot, đặt tên theo pattern `<actionId>.json` trong thư mục `snapshots/` của conversation.
- **Inline_Viewer**: Component React trong conversation UI hiển thị nội dung Snapshot trực tiếp bên trong `FileToolItem` khi người dùng click vào label CREATE/UPDATE.
- **Diff_View**: Chế độ hiển thị trong `Inline_Viewer` dành cho thao tác `replace_in_file`, hiển thị nội dung trước và sau khi thay thế theo định dạng diff (dòng thêm màu xanh, dòng xóa màu đỏ).
- **Full_Content_View**: Chế độ hiển thị trong `Inline_Viewer` dành cho thao tác `write_to_file`, hiển thị toàn bộ nội dung file đã ghi với syntax highlighting.
- **Action_ID**: Định danh duy nhất của một tool action trong một message, có dạng `<messageId>-action-<index>`. Được dùng làm tên file snapshot.
- **FileHandler**: Class `src/controllers/handlers/FileHandler.ts` xử lý các lệnh `writeFile` và `replaceInFile` từ webview.
- **FileToolItem**: Component React `FileToolItem.tsx` hiển thị một tool action liên quan đến file trong conversation UI.

## Requirements

### Requirement 1: Lưu Snapshot Sau Khi write_to_file Thành Công

**User Story:** As a developer using Zen, I want the content written by `write_to_file` to be saved as a snapshot, so that I can review exactly what was written without opening the file.

#### Acceptance Criteria

1. WHEN `FileHandler.handleWriteFile` thực thi thành công và gửi `writeFileResult` với `success: true`, THE `Snapshot_Manager` SHALL lưu một `Snapshot_File` vào thư mục `<Conv_Folder>/snapshots/<actionId>.json` chứa: `filePath`, `operation: "write"`, `afterContent` (nội dung đã ghi), và `timestamp`.
2. WHEN file được ghi lần đầu tiên (file chưa tồn tại trước đó), THE `Snapshot_Manager` SHALL đặt `beforeContent: null` trong `Snapshot_File`, kể cả khi file tồn tại nhưng rỗng (0 bytes).
3. WHEN file đã tồn tại và có nội dung trước khi ghi (rewrite), THE `Snapshot_Manager` SHALL đặt `beforeContent` là nội dung file trước khi ghi vào `Snapshot_File`.
4. IF `FileHandler.handleWriteFile` trả về lỗi, THEN THE `Snapshot_Manager` SHALL không tạo `Snapshot_File` cho thao tác đó; thao tác ghi file vẫn được coi là hoàn thành (không rollback) và lỗi snapshot không ảnh hưởng đến kết quả trả về cho webview.
5. THE `Snapshot_Manager` SHALL tạo thư mục `snapshots/` nếu chưa tồn tại trước khi ghi `Snapshot_File`.
6. WHEN `conversationId` không có trong message `writeFile`, THE `Snapshot_Manager` SHALL bỏ qua việc lưu snapshot cho thao tác đó.

### Requirement 2: Lưu Snapshot Trước và Sau Khi replace_in_file Thành Công

**User Story:** As a developer using Zen, I want both the before and after content of a `replace_in_file` operation to be saved, so that I can see exactly what changed in the file.

#### Acceptance Criteria

1. WHEN `FileHandler.handleReplaceInFile` đọc nội dung file gốc thành công, THE `Snapshot_Manager` SHALL lưu nội dung đó làm `beforeContent` trong `Snapshot_File`.
2. WHEN `FileHandler.handleReplaceInFile` thực thi thành công và gửi `replaceInFileResult` với `success: true`, THE `Snapshot_Manager` SHALL lưu `Snapshot_File` vào `<Conv_Folder>/snapshots/<actionId>.json` chứa: `filePath`, `operation: "replace"`, `beforeContent`, `afterContent` (nội dung sau khi replace), và `timestamp`.
3. IF `FileHandler.handleReplaceInFile` thất bại ở bất kỳ bước nào, THEN THE `Snapshot_Manager` SHALL không tạo `Snapshot_File` cho thao tác đó.
4. THE `Snapshot_Manager` SHALL lưu `afterContent` là nội dung đầy đủ của file sau khi replace (không phải chỉ phần diff).
5. WHEN `conversationId` không có trong message `replaceInFile`, THE `Snapshot_Manager` SHALL bỏ qua việc lưu snapshot cho thao tác đó.

### Requirement 3: Truyền actionId Từ Webview Đến Extension Host

**User Story:** As a developer, I want the webview to send the `actionId` along with file write/replace commands, so that the extension host can correctly name the snapshot file.

#### Acceptance Criteria

1. WHEN `useToolExecution` gửi lệnh `writeFile` qua `extensionService.postMessage`, THE `useToolExecution` SHALL bao gồm trường `actionId` trong message payload.
2. WHEN `useToolExecution` gửi lệnh `replaceInFile` qua `extensionService.postMessage`, THE `useToolExecution` SHALL bao gồm trường `actionId` trong message payload.
3. THE `actionId` được gửi SHALL có dạng `<messageId>-action-<index>` khớp với `actionId` được dùng trong `toolOutputs` của webview.
4. WHEN `FileHandler` nhận message `writeFile` hoặc `replaceInFile`, THE `FileHandler` SHALL chuyển tiếp `actionId` đến `Snapshot_Manager`.

### Requirement 4: Tải Snapshot Từ Extension Host Về Webview

**User Story:** As a developer, I want the webview to be able to request and receive snapshot data, so that the inline viewer can display the file content.

#### Acceptance Criteria

1. WHEN webview gửi message `getSnapshot` với `conversationId` và `actionId`, THE `FileHandler` SHALL đọc `Snapshot_File` tương ứng và gửi lại message `getSnapshotResult` chứa dữ liệu snapshot.
2. IF `Snapshot_File` không tồn tại, THEN THE `FileHandler` SHALL gửi `getSnapshotResult` với `error: "Snapshot not found"`.
3. THE `getSnapshotResult` message SHALL chứa các trường: `requestId`, `actionId`, `filePath`, `operation`, `beforeContent`, `afterContent`, `timestamp`.
4. WHEN `ChatController` nhận command `getSnapshot`, THE `ChatController` SHALL điều hướng đến `FileHandler.handleGetSnapshot`.

### Requirement 5: Hiển Thị Inline Viewer Khi Click Vào Label CREATE/UPDATE

**User Story:** As a developer using Zen, I want to click on the CREATE or UPDATE label in the conversation to see the file content inline, so that I can review changes without leaving the chat panel.

#### Acceptance Criteria

1. WHEN người dùng click vào `ToolHeader` của một `FileToolItem` có `toolType === "write_to_file"` hoặc `toolType === "replace_in_file"`, THE `FileToolItem` SHALL toggle trạng thái hiển thị `Inline_Viewer` và đồng thời gửi message `getSnapshot` đến extension host với `conversationId` và `actionId` tương ứng (nếu snapshot chưa được tải).
2. WHEN `Inline_Viewer` được mở lần đầu và snapshot chưa được tải, THE `FileToolItem` SHALL gửi message `getSnapshot` đến extension host với `conversationId` và `actionId` tương ứng.
3. WHILE snapshot đang được tải, THE `Inline_Viewer` SHALL hiển thị trạng thái loading.
4. IF snapshot không tồn tại hoặc tải thất bại, THEN THE `Inline_Viewer` SHALL hiển thị thông báo lỗi và cung cấp nút để mở file trong editor.
5. WHEN snapshot được tải thành công và `operation === "write"`, THE `Inline_Viewer` SHALL hiển thị `Full_Content_View` với nội dung `afterContent`.
6. WHEN snapshot được tải thành công và `operation === "replace"`, THE `Inline_Viewer` SHALL hiển thị `Diff_View` với `beforeContent` và `afterContent`.
7. WHEN người dùng click lại vào `ToolHeader`, THE `FileToolItem` SHALL đóng `Inline_Viewer`.
8. WHEN `isPartial === true` (tool đang streaming), THE `FileToolItem` SHALL không hiển thị `Inline_Viewer` khi click.

### Requirement 6: Full Content View Cho write_to_file

**User Story:** As a developer, I want to see the full content of a written file with syntax highlighting, so that I can review the code without opening the editor.

#### Acceptance Criteria

1. THE `Full_Content_View` SHALL hiển thị toàn bộ nội dung `afterContent` với syntax highlighting dựa trên phần mở rộng của file (ví dụ: `.ts` → TypeScript, `.py` → Python).
2. THE `Full_Content_View` SHALL hiển thị số dòng bên cạnh mỗi dòng code.
3. THE `Full_Content_View` SHALL có chiều cao tối đa là 400px và hỗ trợ cuộn dọc khi nội dung vượt quá chiều cao đó.
4. THE `Full_Content_View` SHALL hiển thị tên file và số dòng tổng cộng ở header.
5. WHERE `beforeContent` không phải `null` (file đã tồn tại và có nội dung trước đó), THE `Full_Content_View` SHALL hiển thị badge "REWRITE" thay vì "CREATE" ở header.

### Requirement 7: Diff View Cho replace_in_file

**User Story:** As a developer, I want to see a clear diff between before and after content of a replace operation, so that I can understand exactly what changed.

#### Acceptance Criteria

1. THE `Diff_View` SHALL hiển thị các dòng bị xóa với màu đỏ (sử dụng CSS variable `--vscode-gitDecoration-deletedResourceForeground` hoặc tương đương) và prefix `-`.
2. THE `Diff_View` SHALL hiển thị các dòng được thêm với màu xanh (sử dụng CSS variable `--vscode-gitDecoration-addedResourceForeground` hoặc tương đương) và prefix `+`.
3. THE `Diff_View` SHALL hiển thị các dòng không thay đổi (context lines) với màu mặc định và prefix ` ` (space).
4. THE `Diff_View` SHALL hiển thị tối đa 3 dòng context xung quanh mỗi khối thay đổi.
5. THE `Diff_View` SHALL có chiều cao tối đa là 400px và hỗ trợ cuộn dọc.
6. THE `Diff_View` SHALL hiển thị tổng số dòng thêm và xóa ở header (ví dụ: `+12 -5`).
7. THE `Diff_View` SHALL sử dụng font monospace (`var(--vscode-editor-font-family, monospace)`) để hiển thị code.

### Requirement 8: Dọn Dẹp Snapshot Khi Conversation Bị Xóa

**User Story:** As a developer, I want snapshot files to be cleaned up when a conversation is deleted, so that they don't accumulate and waste disk space.

#### Acceptance Criteria

1. WHEN `ConversationHandler.handleDeleteConversation` xóa conversation, THE `ConversationHandler` SHALL xóa toàn bộ thư mục `<Conv_Folder>/snapshots/` cùng với các file khác trong `Conv_Folder`.
2. WHEN `ConversationHandler.handleDeleteAllConversations` xóa tất cả conversations, THE `ConversationHandler` SHALL xóa toàn bộ thư mục `snapshots/` của từng conversation.
3. THE `Snapshot_Manager` SHALL không lưu snapshot cho các file nằm trong thư mục `node_modules`, `.git`, hoặc `khanhromvn-zen` (nhất quán với `CheckpointManager`).

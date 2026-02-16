# Thiết Kế Chi Tiết Context Tool Offline: Bộ Nhớ Ngắn & Dài Hạn

Tài liệu này là bản thiết kế hoàn chỉnh nhất cho **Hệ Thống Quản Lý Ngữ Cảnh (Context Tool)** hoạt động offline trên máy người dùng.

Hệ thống được thiết kế để giải quyết 3 vấn đề cốt lõi:

1.  **Memory Limit**: Vượt qua giới hạn context (50K token) bằng cơ chế "Continuous Rolling".
2.  **Multi-Model**: Hỗ trợ chuyển đổi model AI linh hoạt mà không mất mạch làm việc.
3.  **Performance**: Không làm chậm thao tác chat nhờ kiến trúc Async Queue & Worker.

---

## 1. Kiến Trúc Tổng Quan (High-Level Architecture)

Chúng ta sử dụng mô hình **Centralized Storage (Lưu Trữ Tập Trung)** để quản lý dữ liệu context, giúp tách biệt hoàn toàn dữ liệu metadata khỏi source code dự án.

### 1.1 Vị Trí Lưu Trữ

Toàn bộ dữ liệu nằm tại thư mục gốc của người dùng:

- **Linux/macOS**: `~/.context_tool_data/`
- **Windows**: `%USERPROFILE%\.context_tool_data\`

### 1.2 Cấu Trúc Thư Mục Chi Tiết

```
~/.context_tool_data/
├── root.json
└── projects/                # Nơi chứa dữ liệu thực tế của từng Project
    └── <project_hash_id>/   # Thư mục riêng của từng dự án (theo hash path)
        ├── workspace_rules.md  # Quy tắc riêng (long context) cho workspace này
        ├── workspace.md        # Thông tin cơ bản dự án
        └── <hash>_<conv_id>_<ts>.json         # Chat log (Max 30)
    └── ...
    └── ...
```

---

## 2. Các Thành Phần Cốt Lõi (Core Components)

Hệ thống được tổ chức thành 3 lớp (Layers) chính, kết hợp sức mạnh của Vector Search:

### 2.1 Layer 1: Codebase Brain (Vector Search)

_Mục tiêu: Hiểu sâu dự án thông qua phân tích mã nguồn._

---

## 3. Cơ Chế Hoạt Động Đặc Biệt (Key Mechanisms)

### 3.1 Smart Indexing (Non-Invasive)

Để tránh index file rác mà KHÔNG tạo file cấu hình trong project:

#### Lớp 1: Hard-coded Exclusion (Loại bỏ triệt để)

Tự động bỏ qua các file không phải Plain-Text (không đọc được bằng Text Editor thông thường):

- **Document**: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`.
- **Media**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico`, `.mp4`, `.mp3`, `.wav`.
- **Binary/Archive**: `.exe`, `.dll`, `.so`, `.bin`, `.zip`, `.tar`, `.gz`, `.7z`, `.rar`.
- **System/Build**: `node_modules`, `.git`, `.svn`, `dist`, `build`, `out`, `coverage`.

#### Lớp 2: Git-aware

Tự tìm đọc `.gitignore` (nếu có) và tuân thủ nó.

#### Lớp 3: Heuristics & Content Analysis (Phân tích nội dung)

Trước khi Index, tool sẽ đọc thử file để kiểm tra:

- **Kiểm tra Binary**: Nếu phát hiện ký tự NULL (`\0`) trong 1024 bytes đầu -> Coi là Binary -> **Bỏ qua**.
- **Kiểm tra Minified**: Nếu tỷ lệ (Số ký tự / Số dòng) quá lớn (ví dụ: 1 dòng dài > 3000 ký tự) -> Coi là Minified Code -> **Bỏ qua**.
- **Kiểm tra Size**: File > 1MB (Text Code hiếm khi lớn hơn mức này) -> **Bỏ qua**.

#### Lớp 4: Centralized Skip List (Optional)

Nếu muốn bỏ qua thêm các folder cụ thể cho toàn bộ dự án, User cấu hình trong file `global_rules.md`.

---

### 3.2 Continuous Context Update (Cập Nhật Liên Tục)

Thay vì chờ hết token mới tóm tắt (dễ gây lỗi mất dữ liệu), hệ thống hoạt động theo nguyên tắc **"Always Fresh"**:

1.  **User**: Gửi câu hỏi -> **AI**: Trả lời.
2.  **Immediate Action**: Đẩy cặp {Hỏi - Trả lời} vào **Queue**.
3.  **Background Worker**:
    - Lấy job từ Queue.
    - Dùng một **Small Model** (Gemini Flash / Gemma 2B) để phân tích (nếu cần).
    - **Save History**: Lưu trữ raw messages vào `<hash>_<conv_id>_<ts>.json`.

### 3.3 Context Rolling (Cuộn Ngữ Cảnh)

Giải quyết giới hạn 50K token hoặc khi đổi Model:

1.  **Trigger**: Token count > Limit HOẶC User đổi Model.
2.  **Restart**: Bắt đầu một session mới với file `<ts>.json` mới.
3.  **Inject**: Khởi tạo phiên mới sử dụng nội dung từ file `_summary.md` gần nhất làm ngữ cảnh đầu vào.

---

---

## 4. Metadata & Rules (Quy chuẩn)

Hệ thống sử dụng các file Markdown để quản lý quy tắc và thông tin dự án thay vì file JSON phức tạp:

- **global_rules.md**: Chứa các quy tắc coding tiêu chuẩn áp dụng cho mọi dự án.
- **workspace_rules.md**: Chứa các quy tắc riêng biệt, các thư viện đặc thù hoặc phong cách code của riêng dự án đó.
- **workspace.md**: Chứa mô tả tổng quan về dự án, mục tiêu dự án và chức năng của các thư mục quan trọng.

---

## 5. Công Nghệ Đề Xuất (Recommended Tech Stack)

| Thành Phần        | Công Nghệ / Thư Viện     | Lý Do                                           |
| :---------------- | :----------------------- | :---------------------------------------------- |
| **Language**      | **TypeScript (Node.js)** | Hệ sinh thái mạnh, dễ maintain.                 |
| **Embedding**     | **Gemini Output API**    | Chất lượng cao, chi phí thấp/free.              |
| **Vector DB**     | **LanceDB** (Node)       | Serverless, chạy file local, nhanh hơn SQLite.  |
| **Queue**         | **FastQ** / **BullMQ**   | Quản lý Worker xử lý background.                |
| **File Watcher**  | **Chokidar**             | Theo dõi thay đổi file code.                    |
| **Binary Check**  | **isbinaryfile**         | Thư viện NodeJS kiểm tra file binary heuristic. |
| **CLI Framework** | **Commander.js**         | Xây dựng giao diện dòng lệnh.                   |

---

## 6. Tổng Kết Workflow Người Dùng

1.  **Start**: `ctx start` -> Tool chạy ngầm, load context.
2.  **Chat**: User chat với AI qua giao diện (CLI/Extension).
3.  **Process**:
    - Tool search Vector DB (Code + History).
    - Tool lấy History mới nhất.
    - Ghép thành Prompt -> Gửi AI.
4.  **Update**:
    - Worker ngầm cập nhật History vào JSON.
    - Index code mới nếu User sửa file.
5.  **Finish**: Khi tắt, mọi thứ đã được lưu. Không cần thao tác "Save".

---

## 7. Phụ Lục: Dữ Liệu Mẫu (Sample Content)

(Đã xóa các nội dung mẫu file .md riêng lẻ để chuyển sang cơ chế lưu trữ theo session)

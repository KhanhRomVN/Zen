# Cơ chế Terminal trong VS Code Extension (P2)

VS Code cung cấp các API mạnh mẽ để quản lý terminal. Đối với yêu cầu **streaming dữ liệu thời gian thực**, Pseudoterminal (PTY) là giải pháp tối ưu.

## 1. Streaming dữ liệu: Tại sao dùng Pseudoterminal?

PTY cho phép extension can thiệp trực tiếp vào luồng dữ liệu (Input/Output). Đây là cơ chế tốt nhất để đồng bộ hóa trạng thái terminal lên Webview (qua SSE hoặc postMessage).

- **Kiểm soát tuyệt đối**: Bạn có thể bắt từng ký tự, xử lý các phím đặc biệt (Tab, Ctrl+C).
- **Cách biệt (Isolation)**: Terminal ảo không bị ảnh hưởng bởi các script cấu hình shell cá nhân của người dùng máy tính.
- **Real-time**: Phù hợp hoàn hảo để stream và hiển thị bằng các thư viện như \`xterm.js\`.

## 2. Quản lý danh sách Terminal

Extension có thể cung cấp thông tin về tất cả các terminal đang hoạt động để AI có thể "biết" và tái sử dụng chúng thay vì luôn tạo mới.

\`\`\`typescript
// Lấy danh sách để AI tham chiếu
const terminalList = vscode.window.terminals.map(t => ({
    id: (t as any).id, // Một số thuộc tính ID cần ép kiểu hoặc lấy từ internal
    name: t.name,
    state: t.state
}));
\`\`\`

## 3. Tái sử dụng Terminal trong Toolcall

Khi gọi \`execute_command\`, AI có thể truyền thêm \`terminal_id\`. Logic xử lý ở extension sẽ là:
1. Tìm terminal có ID tương ứng.
2. Nếu thấy → Gọi \`terminal.sendText(command)\`.
3. Nếu không → Tạo mới terminal và chạy lệnh.

## 4. Các thao tác bổ trợ quan trọng

Để hệ thống terminal hoạt động trơn tru, AI cần được trang bị các công cụ:
- **Focus**: Đưa terminal cụ thể lên phía trước để người dùng theo dõi.
- **Interrupt**: Gửi \`^C\` để dừng các lệnh đang chạy treo hoặc chạy lâu.
- **Close**: Dọn dẹp các terminal rác sau khi hoàn thành nhiệm vụ.

---
*Lưu ý: Pseudoterminal yêu cầu viết code backend phức tạp hơn nhưng mang lại trải nghiệm người dùng cao cấp (Premium UX).*

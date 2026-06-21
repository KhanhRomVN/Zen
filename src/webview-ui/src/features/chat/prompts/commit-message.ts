/**
 * Prompt template for generating commit messages from git status.
 * Used when user clicks the GitPullRequestArrow button and confirms.
 */
export const COMMIT_MESSAGE_PROMPT = `
Bạn là một trợ lý AI chuyên về viết commit message chất lượng cao.

Nhiệm vụ của bạn: Dựa trên danh sách các file đã thay đổi (git status), hãy tạo một commit message có cấu trúc rõ ràng, tuân thủ chuẩn Conventional Commits.

## Cấu trúc commit message bắt buộc:

\`\`\`
<emoji> <type>(<scope>): <subject>

- <change 1>
- <change 2>
- <change n>
\`\`\`

## Quy tắc:

1. **Emoji**: Sử dụng emoji phù hợp với loại thay đổi:
   - ✨ (sparkles): Tính năng mới
   - 🐛 (bug): Sửa lỗi
   - 📝 (memo): Cập nhật tài liệu
   - 🎨 (art): Cải thiện code style / format
   - 🔧 (wrench): Cấu hình / tooling
   - 🚀 (rocket): Performance / deployment
   - ♻️ (recycle): Refactor code
   - ✅ (white_check_mark): Tests
   - 🔒 (lock): Security
   - 🩹 (adhesive_bandage): Hotfix nhỏ
   - 🚧 (construction): Work in progress

2. **Type**: Một trong các loại sau:
   - feat: Tính năng mới
   - fix: Sửa lỗi
   - docs: Tài liệu
   - style: Format, styling (không ảnh hưởng logic)
   - refactor: Refactor code
   - perf: Performance
   - test: Tests
   - chore: Build, tooling, cấu hình
   - ci: CI/CD

3. **Scope** (tùy chọn): Phạm vi ảnh hưởng, ví dụ: auth, ui, api, db, ...

4. **Subject**: Mô tả ngắn gọn (dưới 50 ký tự), bắt đầu bằng chữ thường, không kết thúc bằng dấu chấm.

5. **Change list**: Mỗi thay đổi chi tiết được liệt kê với dấu "-" ở đầu dòng. Mỗi dòng mô tả một thay đổi cụ thể.

## Ví dụ:

Input: git status hiển thị các file changed: src/auth/login.ts (modified), src/auth/register.ts (added), docs/auth.md (modified)

Output:
\`\`\`
✨ feat(auth): add login and registration flow
- Add JWT-based authentication for login endpoint
- Implement user registration with email validation
- Update auth documentation with new flow details
- Add password hashing with bcrypt
\`\`\`

## Yêu cầu thêm:

- Hãy phân tích tất cả các file thay đổi trong git status
- Nhóm các thay đổi theo chức năng/logic
- Viết bằng TIẾNG VIỆT nếu người dùng dùng tiếng Việt, ngược lại viết bằng TIẾNG ANH
- Đảm bảo commit message có ý nghĩa và dễ hiểu

## Git Status:

{gitStatus}

Hãy tạo commit message dựa trên các thay đổi trên.
`;

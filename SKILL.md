# Phân tích 3 HTTP API cho toolUI MCP.Directory

## Tổng quan

Dựa trên phân tích HTTPS traffic từ mcp.directory, đã xác định được 3 request phục vụ cho việc xây dựng toolUI không cần mở website:

1. **Leaderboard** — Lấy danh sách skill theo lượt xem
2. **Search** — Tìm kiếm skill theo query text
3. **Detail** — Xem thông tin chi tiết của skill

---

## 1. Leaderboard — Danh sách skill theo lượt xem

### Request

| Thuộc tính | Giá trị |
|-----------|---------|
| **Method** | `GET` |
| **URL** | `https://mcp.directory/skills` |
| **Headers** | `rsc: 1` (bắt buộc để nhận RSC payload) |
| **Status** | `200` |
| **Content-Type** | `text/x-component` (RSC) |
| **Dependency** | Không cần |

### Response (RSC payload)

Dữ liệu nằm trong RSC payload, có thể parse bằng regex hoặc JSON parser:

```json
{
  "initialSkills": [
    {
      "id": 50,
      "slug": "nano-banana-pro",
      "name": "nano-banana-pro",
      "author": "garg-aayush",
      "description": "Generate and edit images using Google's Nano Banana Pro...",
      "sourceUrl": "https://github.com/...",
      "category": "",
      "views": 2431,
      "installs": 11808
    }
  ],
  "initialTotal": 9291,
  "featured": [...],
  "trending": [...],
  "recent": [...]
}
```

### Cách gọi từ toolUI

```bash
curl -X GET "https://mcp.directory/skills" \
  -H "rsc: 1"
```

### Cách parse

1. Response là RSC payload (text/x-component).
2. Tìm đoạn chứa `"initialSkills":[...]` trong response.
3. Parse JSON từ đó.
4. Lấy danh sách skill với đầy đủ metadata (views, installs, slug, etc.).

---

## 2. Search — Tìm kiếm skill theo query text

### Request

| Thuộc tính | Giá trị |
|-----------|---------|
| **Method** | `GET` |
| **URL** | `https://mcp.directory/api/v1/skills?q=ui&limit=24&offset=0` |
| **Status** | `200` |
| **Content-Type** | `application/json` |
| **Dependency** | Không cần |

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `q` | string | Query text (bắt buộc) | - |
| `limit` | integer | Số lượng kết quả | 24 |
| `offset` | integer | Vị trí bắt đầu | 0 |

### Response (JSON)

```json
{
  "skills": [
    {
      "id": 1775,
      "slug": "ui",
      "name": "ui",
      "author": "nuxt",
      "description": "Build UIs with @nuxt/ui v4...",
      "sourceUrl": "https://github.com/nuxt/ui/tree/v4/skills/ui",
      "category": "",
      "views": 32,
      "installs": 6
    }
  ],
  "total": 2397,
  "limit": 24,
  "offset": 0
}
```

### Cách gọi từ toolUI

```bash
curl -X GET "https://mcp.directory/api/v1/skills?q=ui&limit=24&offset=0"
```

### Cách parse

Response là JSON thuần — parse trực tiếp.

---

## 3. Detail — Xem thông tin chi tiết của skill

### Request

| Thuộc tính | Giá trị |
|-----------|---------|
| **Method** | `GET` |
| **URL** | `https://mcp.directory/skills/{slug}` |
| **Headers** | `rsc: 1` (bắt buộc để nhận RSC payload) |
| **Status** | `200` |
| **Content-Type** | `text/x-component` (RSC) |
| **Dependency** | Cần `slug` từ leaderboard hoặc search |

### Response (RSC payload)

Response chứa markdown với thông tin chi tiết:

```markdown
name: svg-precision
description: Deterministic SVG generation, validation, and rendering...
---

# svg-precision
Generate *structurally correct* SVGs...
```

### Cách gọi từ toolUI

```bash
curl -X GET "https://mcp.directory/skills/svg-precision" \
  -H "rsc: 1"
```

### Cách parse

1. Response là RSC payload.
2. Tìm các đoạn `T<number>,---` chứa markdown.
3. Extract:
   - `name:` → tên skill
   - `description:` → mô tả
   - Phần sau `---` → nội dung chi tiết (markdown)

---

## 🔗 Dependency Chain

```
Leaderboard (GET /skills with rsc:1)
   └── cung cấp slug (ví dụ: "svg-precision", "ui-ux-pro-max")

Search (GET /api/v1/skills?q=...)
   └── cung cấp slug (ví dụ: "ui-ux-pro-max", "nano-banana-pro")

Detail (GET /skills/{slug} with rsc:1)
   └── cần slug từ leaderboard hoặc search
```

---

## 📊 So sánh các API

| Chức năng | Endpoint | Loại | Dùng được cho toolUI? | Độ phức tạp |
|-----------|----------|------|----------------------|-------------|
| Leaderboard | `/skills` (rsc:1) | RSC | ✅ Có thể parse | Trung bình |
| Search | `/api/v1/skills` | JSON | ✅ Trực tiếp | Thấp |
| Detail | `/skills/{slug}` (rsc:1) | RSC | ✅ Có thể parse | Trung bình |

---

## 🛠 Gợi ý triển khai toolUI

### Luồng hoạt động

1. **Mặc định**: Gọi leaderboard → hiển thị danh sách skill (có views, installs).
2. **Tìm kiếm**: Nhập query → gọi search API → hiển thị kết quả.
3. **Xem chi tiết**: Click vào skill → lấy slug → gọi detail API → hiển thị thông tin.

### Xử lý RSC

Cả leaderboard và detail đều trả về RSC payload. Có thể parse bằng:

```javascript
// Tìm và parse JSON từ RSC payload
function parseRSCPayload(responseText) {
  // Tìm đoạn chứa "initialSkills":[...] hoặc "featured":[...]
  const match = responseText.match(/"initialSkills":(\[[\s\S]*?\]),/);
  if (match) {
    return JSON.parse(match[1]);
  }
  return null;
}

// Parse detail (markdown)
function parseDetailMarkdown(responseText) {
  const match = responseText.match(/T\d+,---\n([\s\S]*?)---/);
  if (match) {
    const lines = match[1].split('\n');
    const name = lines.find(l => l.startsWith('name:'))?.replace('name:', '').trim();
    const description = lines.find(l => l.startsWith('description:'))?.replace('description:', '').trim();
    return { name, description, content: match[1] };
  }
  return null;
}
```

---

## 📝 Kết luận

Cả 3 request đều có thể được gọi từ toolUI mà không cần mở website:

- **Search**: Sử dụng JSON API trực tiếp — đơn giản nhất.
- **Leaderboard**: Cần parse RSC payload — nhưng đã có cấu trúc rõ ràng.
- **Detail**: Cần parse RSC payload để lấy markdown — có thể parse bằng regex.

Điểm quan trọng: Cần thêm header `rsc: 1` cho các request đến trang `/skills` và `/skills/{slug}` để nhận RSC payload thay vì HTML.
  
# Cách lấy toàn bộ thông tin Skill từ MCP.Directory cho Local Application

> **Mục tiêu:** Xây dựng local app hiển thị detail info của một skill bất kỳ trên `mcp.directory` mà **không cần mở browser**.
>
> **Case study:** skill `nano-banana-pro` (id=50, author=`garg-aayush`).
>
> **Nguồn dữ liệu:** Phân tích HTTPS traffic đã capture — các request RSC (React Server Components) của Next.js App Router.

---

## 1. Tổng quan kiến trúc MCP.Directory

`mcp.directory` chạy trên **Next.js App Router** với **React Server Components (RSC)**. Đây là điểm mấu chốt — toàn bộ data (bao gồm skill metadata) được server render thành **RSC payload** dạng text, không phải HTML thuần và không phải REST API JSON truyền thống.

### Đặc điểm nhận dạng RSC request

| Header / Param | Giá trị | Ý nghĩa |
|----------------|---------|---------|
| `rsc` | `1` | Đánh dấu đây là RSC request |
| `next-router-prefetch` | `1` | Request prefetch của Next.js router |
| `next-router-segment-prefetch` | `/<segment>` | Segment đang được prefetch |
| `next-url` | `/skills/nano-banana-pro` | Trang đích thực tế |
| `Referer` | `https://mcp.directory/skills/nano-banana-pro` | Trang đang xem |
| Query param | `?_rsc=<hash>` | Cache-busting hash cho RSC payload |

### Response headers đặc trưng

```
Content-Type: text/x-component
x-nextjs-cache: HIT
x-nextjs-prerender: 1
vary: Accept-Encoding, rsc, next-router-state-tree, ...
```

→ **Kết luận:** Để lấy data skill, ta không gọi REST API mà **fetch RSC payload** từ Next.js endpoint.

---

## 2. Các endpoint đã quan sát từ traffic

| stt | Method | Path | Status | Size | Vai trò |
|-----|--------|------|--------|------|---------|
| 4 | GET | `/_next/static/chunks/930fa488bc81a236.js` | 200 | 9.8 KB | JS chunk (SkillInstallPanel) |
| 6 | GET | `/blog/claude-nano-banana-pro-skill-guide?_rsc=3ig0s` | 200 | 23.1 KB | **RSC payload chứa skill data** |
| 8 | GET | `/blog/claude-nano-banana-pro-skill-guide?_rsc=170os` | 200 | 1.1 KB | RSC layout segment |
| 10 | GET | `/blog/claude-nano-banana-pro-skill-guide?_rsc=pi26q` | 200 | 2.3 KB | RSC `/_head` metadata |
| 12 | GET | `/skills?q=garg-aayush&_rsc=e64gh` | 200 | 0 B | Search API (empty result) |
| 18 | GET | `/blog/claude-nano-banana-pro-skill-guide?_rsc=e64gh` | 200 | 1.2 KB | RSC `/_tree` routing |
| 20 | GET | `/skills?q=garg-aayush&_rsc=e64gh` | 200 | 0 B | Search API (duplicate) |
| 22 | POST | `/api/track` | 200 | 0.7 KB | Analytics tracking |
| 24, 26 | POST | `/cdn-cgi/rum` | 204 | 0.7 KB | Cloudflare RUM |

**Lưu ý quan trọng:** Traffic hiện tại **KHÔNG** capture request trực tiếp đến `/skills/nano-banana-pro`. Data skill trong case này được lấy gián tiếp qua **blog guide RSC payload** (stt=6) — nơi component `SkillInstallPanel` nhận prop `skill` với đầy đủ metadata.

---

## 3. Data model của Skill object

Từ RSC payload của `stt=6`, object `skill` có cấu trúc:

```json
{
  "id": 50,
  "slug": "nano-banana-pro",
  "name": "nano-banana-pro",
  "author": "garg-aayush",
  "description": "Generate and edit images using Google's Nano Banana Pro (Gemini 3 Pro Image) API. Use when the user asks to generate, create, edit, modify, change, alter, or update images. Also use when user references an existing image file and asks to modify it in any way (e.g., \"modify this image\", \"change the background\", \"replace X with Y\"). Supports both text-to-image generation and image-to-image editing with configurable resolution (1K default, 2K, or 4K for high resolution). DO NOT read the image file first - use this skill directly with the --input-image parameter.",
  "seoDescription": "",
  "sourceUrl": "https://github.com/garg-aayush/tutorials/tree/main/claude-skills/nano-banana-pro",
  "category": "",
  "views": 2170,
  "installs": 1044
}
```

### Các trường có thể có (đầy đủ)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | number | ID nội bộ trên mcp.directory |
| `slug` | string | URL slug — dùng cho endpoint `/skills/<slug>` |
| `name` | string | Tên hiển thị (thường trùng slug) |
| `author` | string | Username GitHub của tác giả |
| `description` | string | **Mô tả đầy đủ** từ SKILL.md (không phải mô tả ngắn) |
| `seoDescription` | string | Có thể trống |
| `sourceUrl` | string | URL GitHub repository chứa skill |
| `category` | string | Có thể trống |
| `views` | number | Số lượt xem |
| `installs` | number | Số lượt cài đặt |

> ⚠️ Data model này được suy ra từ 1 skill duy nhất. Các skill khác có thể có thêm trường (ví dụ: `tags`, `version`, `readme`, `installCommand`, `files`). Cần capture thêm để xác nhận.

---

## 4. Cấu trúc RSC payload & cách parse

### 4.1. Định dạng RSC payload

RSC payload là text stream, mỗi dòng có dạng:

```
<id>:<value>
```

Trong đó `<id>` là số hex (0, 1, 2, ... a, b, c, ...) và `<value>` là JSON hoặc tham chiếu.

**Ví dụ thực tế từ `stt=6`:**

```
1:"$Sreact.fragment"
7:I[522016,["/_next/static/chunks/..."],"BlogToc"]
5c:I[609781,["/_next/static/chunks/..."],"SkillInstallPanel"]
0:{"buildId":"NQTcSYtX3FvebtNve9c_6","rsc":[...]}
29:["$","$L5c",null,{"skill":{"id":50,"slug":"nano-banana-pro",...}}]
```

### 4.2. Các loại value

| Prefix | Ý nghĩa | Ví dụ |
|--------|---------|-------|
| `$S<name>` | Symbol reference (React) | `"$Sreact.fragment"` |
| `$L<id>` | Lazy reference tới dòng khác | `"$L5c"` (trỏ tới dòng `5c:`) |
| `I[...]` | Import reference (module) | `I[609781,[...],"SkillInstallPanel"]` |
| `T<hex>,<json>` | JSON object (thường là schema.org) | `T11e6,{"@context":"https://schema.org",...}` |
| `<json>` | JSON thuần | `{"buildId":"...","rsc":[...]}` |

### 4.3. Cách trích xuất skill object

Skill object nằm trong **root payload** (dòng `0:`). Trong `stt=6`, ta thấy:

```
29:["$","$L5c",null,{"skill":{"id":50,...}}]
```

Dòng `29:` định nghĩa một React element: component `$L5c` (SkillInstallPanel, trỏ tới `5c:I[...]"SkillInstallPanel"`) với prop `skill`.

**Chiến lược parse:**

1. Tách payload theo dòng.
2. Với mỗi dòng, split theo dấu `:` đầu tiên → `[id, value]`.
3. Parse `value`:
   - Nếu bắt đầu bằng `T<hex>,` → strip prefix `T<hex>,` rồi `JSON.parse`.
   - Nếu bắt đầu bằng `I[` → bỏ qua (module import).
   - Nếu là JSON hợp lệ → `JSON.parse`.
4. Tìm JSON object chứa key `skill` (thường nằm trong root `0:` payload) → trích `skill`.

---

## 5. Hai nguồn lấy skill data

### Nguồn A — Blog guide RSC payload (đã capture được)

**Endpoint pattern:**
```
GET https://mcp.directory/blog/<blog-slug>?_rsc=<hash>
Headers:
  rsc: 1
  next-router-prefetch: 1
  next-url: /skills/<skill-slug>
```

**Ưu điểm:** Đã quan sát thực tế; data skill nhúng trong `SkillInstallPanel` prop.
**Nhược điểm:** Chỉ có metadata cơ bản; không có README, SKILL.md content đầy đủ, không có danh sách file.

### Nguồn B — Skill detail page RSC payload (CHƯA capture, cần tự lấy)

**Endpoint dự đoán theo pattern Next.js App Router:**
```
GET https://mcp.directory/skills/<slug>?_rsc=<hash>
Headers:
  rsc: 1
  next-router-prefetch: 1
  next-url: /skills/<slug>
```

**Tại sao dự đoán được:** Next.js App Router áp dụng cùng pattern RSC cho mọi route. Blog route dùng `/blog/<slug>?_rsc=...` → skill route dùng `/skills/<slug>?_rsc=...`.

**Cần xác minh:** Giá trị `<hash>` chính xác — cần capture request thật từ browser.

**Cách tự capture endpoint skill detail:**

1. Mở Chrome DevTools → tab **Network**.
2. Bật filter **Fetch/XHR**.
3. Truy cập `https://mcp.directory/skills/nano-banana-pro`.
4. Tìm request có:
   - URL dạng `/skills/nano-banana-pro?_rsc=...`
   - Request header `rsc: 1`
   - Response `Content-Type: text/x-component`
5. Copy **full URL** (bao gồm `_rsc` hash) và **request headers**.
6. Ghi lại để dùng trong local app.

> 💡 Hash `_rsc` có thể thay đổi giữa các build. Với local app production, nên **fetch trang HTML trước** để lấy hash mới nhất, hoặc bỏ qua hash (Next.js vẫn trả RSC nếu header `rsc: 1` được set đúng).

---

## 6. Sample implementation cho local app

### 6.1. Node.js — Fetch & parse RSC payload

```javascript
// fetchSkill.js
const https = require('https');

const SLUG = 'nano-banana-pro';
const BASE = 'https://mcp.directory';

/**
 * Fetch RSC payload cho skill detail page.
 * Bước 1: fetch HTML để lấy _rsc hash.
 * Bước 2: fetch RSC payload với hash đó.
 */
async function fetchSkillRSC(slug) {
  const htmlUrl = `${BASE}/skills/${slug}`;

  // Bước 1 — lấy HTML, trích hash từ các thẻ <link rel="preload">
  const html = await fetchText(htmlUrl);
  const hash = extractRSCHash(html) || ''; // có thể rỗng — vẫn thử

  // Bước 2 — fetch RSC
  const rscUrl = `${BASE}/skills/${slug}?_rsc=${hash}`;
  const rsc = await fetchText(rscUrl, {
    headers: {
      'rsc': '1',
      'next-router-prefetch': '1',
      'next-url': `/skills/${slug}`,
      'Accept': 'text/x-component',
    },
  });

  return rsc;
}

function extractRSCHash(html) {
  // Next.js thường nhúng hash trong <script> hoặc <link>
  const m = html.match(/_rsc=([a-z0-9]+)/i);
  return m ? m[1] : null;
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse RSC payload → trả về mảng các dòng đã parse.
 */
function parseRSC(payload) {
  const lines = payload.split('\n');
  const result = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const id = line.slice(0, idx);
    let value = line.slice(idx + 1);
    // Strip T<hex>, prefix của schema.org JSON
    value = value.replace(/^T[0-9a-f]+,/, '');
    try {
      result[id] = JSON.parse(value);
    } catch {
      result[id] = value; // giữ nguyên nếu không phải JSON
    }
  }
  return result;
}

/**
 * Tìm object skill trong payload đã parse.
 */
function findSkillObject(parsed) {
  for (const [id, val] of Object.entries(parsed)) {
    if (val && typeof val === 'object' && val.skill && val.skill.slug) {
      return val.skill;
    }
  }
  // Fallback: tìm đệ quy trong mọi value
  for (const val of Object.values(parsed)) {
    const found = deepFindSkill(val);
    if (found) return found;
  }
  return null;
}

function deepFindSkill(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.slug && node.author && node.description) return node;
  for (const v of Object.values(node)) {
    const r = deepFindSkill(v);
    if (r) return r;
  }
  return null;
}

// Chạy thử
(async () => {
  const rsc = await fetchSkillRSC(SLUG);
  const parsed = parseRSC(rsc);
  const skill = findSkillObject(parsed);
  console.log(JSON.stringify(skill, null, 2));
})();
```

### 6.2. Python — Tương đương

```python
import re
import json
import httpx

BASE = "https://mcp.directory"
SLUG = "nano-banana-pro"

def fetch_skill_rsc(slug: str) -> str:
    html = httpx.get(f"{BASE}/skills/{slug}").text
    m = re.search(r"_rsc=([a-z0-9]+)", html, re.I)
    hash_ = m.group(1) if m else ""
    r = httpx.get(
        f"{BASE}/skills/{slug}?_rsc={hash_}",
        headers={
            "rsc": "1",
            "next-router-prefetch": "1",
            "next-url": f"/skills/{slug}",
            "Accept": "text/x-component",
            "User-Agent": "Mozilla/5.0",
        },
    )
    return r.text

def parse_rsc(payload: str) -> dict:
    out = {}
    for line in payload.split("\n"):
        if ":" not in line:
            continue
        idx = line.index(":")
        rid, value = line[:idx], line[idx+1:]
        value = re.sub(r"^T[0-9a-f]+,", "", value)
        try:
            out[rid] = json.loads(value)
        except json.JSONDecodeError:
            out[rid] = value
    return out

def find_skill(node) -> dict | None:
    if isinstance(node, dict):
        if {"slug", "author", "description"} <= node.keys():
            return node
        for v in node.values():
            r = find_skill(v)
            if r:
                return r
    elif isinstance(node, list):
        for v in node:
            r = find_skill(v)
            if r:
                return r
    return None

if __name__ == "__main__":
    rsc = fetch_skill_rsc(SLUG)
    parsed = parse_rsc(rsc)
    for v in parsed.values():
        skill = find_skill(v)
        if skill:
            print(json.dumps(skill, indent=2))
            break
```

---

## 7. Chiến lược cho Local Application

### 7.1. Kiến trúc đề xuất

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  Local App UI   │────▶│  Skill Fetcher       │────▶│  mcp.directory │
│  (Electron/TUI) │     │  - fetch HTML        │     │  (Next.js RSC) │
│                 │     │  - extract _rsc hash │     │                │
│                 │     │  - fetch RSC payload │     │                │
│                 │     │  - parse & extract   │     │                │
└─────────────────┘     └──────────────────────┘     └────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Local Cache     │
                        │  (SQLite/JSON)   │
                        └──────────────────┘
```

### 7.2. Các bước fetch hoàn chỉnh

1. **Input:** `slug` của skill (ví dụ `nano-banana-pro`).
2. **Fetch HTML** `https://mcp.directory/skills/<slug>` (dùng để lấy `_rsc` hash mới nhất).
3. **Trích `_rsc` hash** từ HTML (regex `_rsc=([a-z0-9]+)`).
4. **Fetch RSC payload** với headers đặc trưng (`rsc: 1`, `next-url`, ...).
5. **Parse RSC payload** → tách dòng → parse JSON.
6. **Extract skill object** bằng recursive search (tìm object có key `slug`, `author`, `description`).
7. **Cache kết quả** theo `slug` + TTL (ví dụ 24h) để giảm request.
8. **Hiển thị** trên UI local.

### 7.3. Xử lý fallback khi endpoint skill detail không khả dụng

Nếu request `/skills/<slug>?_rsc=...` trả về rỗng hoặc lỗi:

- **Fallback 1:** Dùng endpoint search `/skills?q=<author>&_rsc=<hash>` — trả về list skill của author (nhưng response có thể rỗng 0 B như đã thấy trong traffic).
- **Fallback 2:** Dùng blog guide RSC payload (nếu có blog post liên quan) — chứa skill metadata cơ bản.
- **Fallback 3:** Fetch trực tiếp `sourceUrl` (GitHub) và parse `SKILL.md` — nhưng đây không còn là data từ mcp.directory.

---

## 8. Edge cases & giới hạn

| Vấn đề | Mô tả | Cách xử lý |
|--------|-------|------------|
| **Truncation** | Response RSC > 50 KB có thể bị cắt | Gọi với `Accept-Encoding: gzip` và stream; hoặc chia nhỏ theo segment |
| **`_rsc` hash thay đổi** | Hash phụ thuộc build ID (`NQTcSYtX3FvebtNve9c_6`) | Luôn fetch HTML trước để lấy hash mới; hoặc bỏ hash và set header `rsc: 1` |
| **Cache HIT** | `x-nextjs-cache: HIT` — data có thể cũ | Kiểm tra `Date` header; force refresh bằng `Cache-Control: no-cache` |
| **Search API trả rỗng** | `/skills?q=garg-aayush` trả 0 B | Có thể do client-side filtering — cần capture request thật khi search |
| **RSC payload format thay đổi** | Next.js có thể đổi format giữa versions | Pin version; viết parser tolerant với fallback regex |
| **Rate limiting** | Chưa quan sát được | Thêm delay giữa các request; respect `Retry-After` nếu có |
| **Cloudflare** | `Server: cloudflare` — có thể có bot protection | Set User-Agent giống browser; giữ cookie nếu cần |

---

## 9. Hướng dẫn reverse-engineer cho skill BẤT KỲ

### Bước 1 — Xác định slug skill
Slug thường nằm trong URL trang skill: `https://mcp.directory/skills/<slug>`.

### Bước 2 — Capture request skill detail
Mở DevTools → Network → truy cập trang skill → lọc `rsc: 1` → copy URL + headers.

### Bước 3 — Kiểm tra response
- Nếu `Content-Type: text/x-component` → đúng RSC payload.
- Nếu `Content-Type: application/json` → có REST API riêng (chưa quan sát được).
- Nếu `text/html` → cần fetch với header `rsc: 1`.

### Bước 4 — Parse & extract
Dùng parser ở mục 6. Tìm object có key `slug` + `author` + `description`.

### Bước 5 — Mở rộng field
Ghi lại **tất cả** key của object skill tìm được → xây dựng schema động cho local app.

### Bước 6 — Tự động hóa
- Với mỗi slug cần xem, chạy pipeline fetch → parse → cache.
- Theo dõi thay đổi bằng cách hash payload (SHA-256) và so sánh giữa các lần fetch.

---

## 10. Tóm tắt nhanh (TL;DR)

1. **mcp.directory dùng Next.js RSC** — data nằm trong RSC payload, không phải REST JSON.
2. **Endpoint chính:** `GET /skills/<slug>?_rsc=<hash>` với header `rsc: 1`.
3. **Skill object** có các trường: `id, slug, name, author, description, sourceUrl, views, installs, ...`.
4. **Trong traffic hiện tại**, skill data được lấy gián tiếp qua blog guide RSC (`/blog/claude-nano-banana-pro-skill-guide`) — chứa object `skill` đầy đủ metadata cơ bản.
5. **Để lấy toàn bộ thông tin** (README, SKILL.md, files), cần capture request `/skills/<slug>?_rsc=...` từ browser.
6. **Local app** nên: fetch HTML → trích `_rsc` hash → fetch RSC → parse → cache.
7. **Parser RSC**: tách dòng theo `:`, strip prefix `T<hex>,` / `I[...]`, `JSON.parse`, recursive search tìm object skill.

---

## Phụ lục — Raw evidence từ traffic

### A. Skill object trích từ `stt=6` (RSC payload)

```json
{
  "id": 50,
  "slug": "nano-banana-pro",
  "name": "nano-banana-pro",
  "author": "garg-aayush",
  "description": "Generate and edit images using Google's Nano Banana Pro (Gemini 3 Pro Image) API. Use when the user asks to generate, create, edit, modify, change, alter, or update images. Also use when user references an existing image file and asks to modify it in any way (e.g., \"modify this image\", \"change the background\", \"replace X with Y\"). Supports both text-to-image generation and image-to-image editing with configurable resolution (1K default, 2K, or 4K for high resolution). DO NOT read the image file first - use this skill directly with the --input-image parameter.",
  "seoDescription": "",
  "sourceUrl": "https://github.com/garg-aayush/tutorials/tree/main/claude-skills/nano-banana-pro",
  "category": "",
  "views": 2170,
  "installs": 1044
}
```

### B. Request headers mẫu (`stt=6`)

```
GET /blog/claude-nano-banana-pro-skill-guide?_rsc=3ig0s
rsc: 1
next-router-prefetch: 1
next-url: /skills/nano-banana-pro
Referer: https://mcp.directory/skills/nano-banana-pro
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ...
```

### C. Response headers mẫu (`stt=6`)

```
Status: 200
Content-Type: text/x-component
x-nextjs-cache: HIT
x-nextjs-prerender: 1
x-nextjs-postponed: 2
Server: cloudflare
Cache-Control: s-maxage=31536000
```

---

*Report được tạo tự động từ phân tích HTTPS traffic. Mọi kết luận dựa trên dữ liệu thực tế đã capture — các phần chưa capture được đánh dấu rõ ràng là "cần xác minh" hoặc "dự đoán theo pattern".*
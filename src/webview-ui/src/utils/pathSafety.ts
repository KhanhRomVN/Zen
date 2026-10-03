/**
 * Kiểm tra xem một đường dẫn hệ thống có chứa ký tự gây rủi ro khi chạy qua
 * shell (bash/zsh) hay không.
 *
 * Bối cảnh: Claude provider nhận workspace dưới dạng ZIP, nhưng khi user chọn
 * project local thì ZenCLI/shell wrapper sẽ cd vào `rootPath`. Nếu path chứa
 * space hoặc shell-meta character mà không được quote đúng, lệnh bash sẽ vỡ.
 */

export interface PathSafetyIssue {
  char: string;
  /** Mô tả ngắn cho UI (VD: "khoảng trắng", "dấu @") */
  description: string;
}

const RISKY_CHARS: Array<[RegExp, string]> = [
  [/ /g, "khoảng trắng"],
  [/@/g, "dấu @"],
  [/&/g, "dấu &"],
  [/\#/g, "dấu #"],
  [/\$/g, "dấu $"],
  [/!/g, "dấu !"],
  [/\(/g, "dấu ("],
  [/\)/g, "dấu )"],
  [/'/g, "dấu nháy đơn '"],
  [/"/g, "dấu nháy kép \""],
  [/`/g, "backtick `"],
  [/\|/g, "dấu |"],
  [/;/g, "dấu ;"],
  [/</g, "dấu <"],
  [/>/g, "dấu >"],
  [/\*/g, "dấu *"],
  [/\?/g, "dấu ?"],
  [/\[/g, "dấu ["],
  [/\]/g, "dấu ]"],
  [/\{/g, "dấu {"],
  [/\}/g, "dấu }"],
];

/**
 * Trả về danh sách các ký tự rủi ro tìm thấy trong path (unique, giữ thứ tự phát hiện).
 * Path rỗng/null → mảng rỗng (coi là an toàn — caller tự quyết định cách hiển thị).
 */
export const detectPathIssues = (path: string | null | undefined): PathSafetyIssue[] => {
  if (!path) return [];
  const seen = new Set<string>();
  const issues: PathSafetyIssue[] = [];
  for (const [regex, description] of RISKY_CHARS) {
    regex.lastIndex = 0; // reset global regex state
    if (regex.test(path)) {
      const ch = description.replace(/^dấu\s+/, "").replace(/\s+.*/, "");
      // Lấy chính xác ký tự đã match để display
      const matchChar = path.match(new RegExp(regex.source.replace(/g$/, ""), ""));
      const key = matchChar ? matchChar[0] : description;
      if (!seen.has(key)) {
        seen.add(key);
        issues.push({ char: key, description });
      }
    }
  }
  return issues;
};

/**
 * Format danh sách issue thành chuỗi ngắn gọn cho tooltip/title.
 * VD: "khoảng trắng, dấu @, dấu &"
 */
export const formatPathIssues = (issues: PathSafetyIssue[]): string => {
  if (issues.length === 0) return "";
  return issues.map((i) => i.description).join(", ");
};
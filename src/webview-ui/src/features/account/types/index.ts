/**
 * ------------------------------------------------------------------
 * Account Types
 * ------------------------------------------------------------------
 * Định nghĩa kiểu dữ liệu dùng chung cho tính năng quản lý tài khoản.
 *
 * Main types:
 * - Account          : Thông tin tài khoản cơ bản
 * - Pagination       : Cấu trúc phân trang trả về từ backend
 * - AccountStats     : Thống kê sử dụng của tài khoản
 * - FlatAccount      : Tài khoản kèm thông tin mở rộng (usage, trạng thái...)
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────
export interface Account {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AccountStats {
  id: string;
  email: string;
  provider_id: string;
  total_requests: number;
  successful_requests: number;
  total_tokens: number;
}

export interface FlatAccount extends Account {
  total_requests?: number;
  successful_requests?: number;
  total_tokens?: number;
  period_requests?: number;
  period_tokens?: number;
  user_data_dir?: string;
  max_req_conversation?: number;
  max_token_conversation?: number;
  isActive?: boolean;
  last_refreshed_at?: number;
  usage?: string;
  reset_period?: string;
  is_active_cli?: boolean;
}
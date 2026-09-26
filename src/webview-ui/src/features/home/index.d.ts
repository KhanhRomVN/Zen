/**
 * ------------------------------------------------------------------
 * HomePanel
 * ------------------------------------------------------------------
 * Panel trang chủ — hiển thị dashboard thống kê, slogan, và MessageInput.
 * Bao gồm stats grid, model distribution, daily usage chart, recent activity.

 * Main features:
 * - Dashboard stats: tổng tokens, requests, favorite model, số tài khoản
 * - Biểu đồ phân bố model và daily usage
 * - Danh sách hội thoại gần đây
 * - MessageInput với draft auto-save, file handling
 * ------------------------------------------------------------------
 */
import React from "react";
interface HomePanelProps {
    onSendMessage: (content: string, files: any[], model: any, account: any, conversationOverrides?: {
        diagnosticEnabled?: boolean;
        useSkillEnabled?: boolean;
    }) => void;
    onLoadConversation: (conversationId: string, tabId: number, folderPath: string | null) => void;
    initialValue?: string;
}
declare const HomePanel: React.FC<HomePanelProps>;
export default HomePanel;
//# sourceMappingURL=index.d.ts.map
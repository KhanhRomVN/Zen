#!/bin/bash
# Script để xóa các file .d.ts và .d.ts.map trong thư mục src/webview-ui/src
# Author: Auto-generated
# Usage: ./remove-dts-files.sh

TARGET_DIR="src/webview-ui/src"
EXCLUDE_FILE="src/webview-ui/src/types/css.d.ts"

echo "=========================================="
echo "Đang tìm kiếm các file .d.ts và .d.ts.map trong: $TARGET_DIR"
echo "=========================================="

# Kiểm tra xem thư mục có tồn tại không
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Lỗi: Thư mục '$TARGET_DIR' không tồn tại!"
    exit 1
fi

# Đếm số lượng file .d.ts và .d.ts.map (loại trừ css.d.ts)
DTS_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts" ! -path "$EXCLUDE_FILE" | wc -l)
MAP_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts.map" | wc -l)
TOTAL_COUNT=$((DTS_COUNT + MAP_COUNT))

if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo "✅ Không tìm thấy file .d.ts hoặc .d.ts.map nào để xóa."
    exit 0
fi

echo "📝 Tìm thấy $DTS_COUNT file .d.ts (loại trừ css.d.ts)"
echo "📝 Tìm thấy $MAP_COUNT file .d.ts.map"
echo "📝 Tổng cộng: $TOTAL_COUNT file"
echo ""

# Xóa tự động không cần xác nhận (loại trừ css.d.ts)
echo "🗑️  Đang xóa các file..."
find "$TARGET_DIR" -type f -name "*.d.ts" ! -path "$EXCLUDE_FILE" -delete
find "$TARGET_DIR" -type f -name "*.d.ts.map" -delete

echo "✅ Đã xóa thành công $TOTAL_COUNT file (.d.ts và .d.ts.map)"
echo "ℹ️  File css.d.ts đã được giữ lại"
echo "=========================================="
echo "Hoàn tất!"
echo "=========================================="
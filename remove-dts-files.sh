#!/bin/bash

# Script để xóa các file .d.ts và .d.ts.map trong thư mục src/webview-ui/src
# Author: Auto-generated
# Usage: ./remove-dts-files.sh

TARGET_DIR="src/webview-ui/src"

echo "=========================================="
echo "Đang tìm kiếm các file .d.ts và .d.ts.map trong: $TARGET_DIR"
echo "=========================================="

# Kiểm tra xem thư mục có tồn tại không
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Lỗi: Thư mục '$TARGET_DIR' không tồn tại!"
    exit 1
fi

# Đếm số lượng file .d.ts và .d.ts.map
DTS_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts" | wc -l)
MAP_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts.map" | wc -l)
TOTAL_COUNT=$((DTS_COUNT + MAP_COUNT))

if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo "✅ Không tìm thấy file .d.ts hoặc .d.ts.map nào để xóa."
    exit 0
fi

echo "📝 Tìm thấy $DTS_COUNT file .d.ts"
echo "📝 Tìm thấy $MAP_COUNT file .d.ts.map"
echo "📝 Tổng cộng: $TOTAL_COUNT file"
echo ""
echo "Danh sách các file sẽ bị xóa:"
echo ""
echo "--- File .d.ts ---"
find "$TARGET_DIR" -type f -name "*.d.ts"
echo ""
echo "--- File .d.ts.map ---"
find "$TARGET_DIR" -type f -name "*.d.ts.map"
echo ""

# Xác nhận trước khi xóa
read -p "⚠️  Bạn có chắc chắn muốn xóa những file này? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Đang xóa các file..."
    find "$TARGET_DIR" -type f -name "*.d.ts" -delete
    find "$TARGET_DIR" -type f -name "*.d.ts.map" -delete
    echo "✅ Đã xóa thành công $TOTAL_COUNT file (.d.ts và .d.ts.map)"
else
    echo "❌ Hủy bỏ thao tác xóa."
    exit 0
fi

echo "=========================================="
echo "Hoàn tất!"
echo "=========================================="
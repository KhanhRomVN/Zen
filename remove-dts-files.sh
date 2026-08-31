#!/bin/bash
# Script để xóa các file .d.ts và .d.ts.map trong thư mục src/webview-ui/src
# Author: Auto-generated
# Usage:
#   ./remove-dts-files.sh         # Chạy 1 lần
#   ./remove-dts-files.sh watch   # Chạy chế độ watch (ngầm)

TARGET_DIR="src/webview-ui/src"
EXCLUDE_PATTERN="-path */types/css.d.ts -o -path */types/window.d.ts -o -path */types/storage.d.ts"

# Function xóa file .d.ts và .d.ts.map
remove_dts_files() {
    local quiet_mode=$1

    # Đếm số lượng file
    DTS_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts" ! \( $EXCLUDE_PATTERN \) 2>/dev/null | wc -l)
    MAP_COUNT=$(find "$TARGET_DIR" -type f -name "*.d.ts.map" 2>/dev/null | wc -l)
    TOTAL_COUNT=$((DTS_COUNT + MAP_COUNT))

    if [ "$TOTAL_COUNT" -eq 0 ]; then
        [ "$quiet_mode" != "quiet" ] && echo "✅ Không có file .d.ts hoặc .d.ts.map nào để xóa."
        return 0
    fi

    # Xóa files
    find "$TARGET_DIR" -type f -name "*.d.ts" ! \( $EXCLUDE_PATTERN \) -delete 2>/dev/null
    find "$TARGET_DIR" -type f -name "*.d.ts.map" -delete 2>/dev/null

    if [ "$quiet_mode" != "quiet" ]; then
        echo "✅ [$(date '+%H:%M:%S')] Đã xóa $TOTAL_COUNT file (.d.ts và .d.ts.map)"
    fi
}

# Chế độ watch
watch_mode() {
    echo "=========================================="
    echo "🔍 Chế độ WATCH được kích hoạt"
    echo "📂 Theo dõi: $TARGET_DIR"
    echo "⏸️  Nhấn Ctrl+C để dừng"
    echo "=========================================="

    # Xóa các file hiện tại trước
    remove_dts_files

    # Kiểm tra tool có sẵn không
    if command -v inotifywait &> /dev/null; then
        # Linux: Dùng inotifywait
        echo "🐧 Sử dụng inotifywait (Linux)"
        inotifywait -m -r -e create,moved_to --format '%w%f' "$TARGET_DIR" 2>/dev/null | while read FILE
        do
            if [[ "$FILE" == *.d.ts ]] || [[ "$FILE" == *.d.ts.map ]]; then
                # Kiểm tra không phải file exclude
                if [[ "$FILE" != */types/css.d.ts ]] && [[ "$FILE" != */types/window.d.ts ]] && [[ "$FILE" != */types/storage.d.ts ]]; then
                    rm -f "$FILE" 2>/dev/null
                    echo "🗑️  [$(date '+%H:%M:%S')] Đã xóa: $FILE"
                fi
            fi
        done
    elif command -v fswatch &> /dev/null; then
        # macOS: Dùng fswatch
        echo "🍎 Sử dụng fswatch (macOS)"
        fswatch -0 -r "$TARGET_DIR" | while read -d "" FILE
        do
            if [[ "$FILE" == *.d.ts ]] || [[ "$FILE" == *.d.ts.map ]]; then
                if [[ "$FILE" != */types/css.d.ts ]] && [[ "$FILE" != */types/window.d.ts ]] && [[ "$FILE" != */types/storage.d.ts ]]; then
                    rm -f "$FILE" 2>/dev/null
                    echo "🗑️  [$(date '+%H:%M:%S')] Đã xóa: $FILE"
                fi
            fi
        done
    else
        # Fallback: Dùng polling (kiểm tra mỗi 2s)
        echo "⚠️  Không tìm thấy inotifywait/fswatch, dùng polling mode"
        while true; do
            remove_dts_files "quiet"
            sleep 2
        done
    fi
}

# Main logic
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Lỗi: Thư mục '$TARGET_DIR' không tồn tại!"
    exit 1
fi

if [ "$1" = "watch" ]; then
    watch_mode
else
    # Chạy 1 lần
    echo "=========================================="
    echo "Đang tìm kiếm các file .d.ts và .d.ts.map trong: $TARGET_DIR"
    echo "=========================================="
    remove_dts_files
    echo "ℹ️  File css.d.ts, window.d.ts và storage.d.ts đã được giữ lại"
    echo "=========================================="
    echo "Hoàn tất!"
    echo "=========================================="
fi

Output: [run_command for 'printf "Vui lòng nhập kết quả cho câu hỏi 1 + 1 = ?: " >&2; read ans1; if [ "$ans1" = "2" ]; then echo "true"; else echo "false"; fi; printf "Vui lòng nhập kết quả cho câu hỏi 2 + 2 = ?: " >&2; read ans2; if [ "$ans2" = "4" ]; then echo "true"; else echo "false"; fi']
```
Vui lòng nhập kết quả cho câu hỏi 1 + 1 = ?: true
Vui lòng nhập kết quả cho câu hỏi 2 + 2 = ?: false
```
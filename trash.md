Output: [run_command for 'printf "Vui lòng nhập kết qủa cho câu hỏi 1 + 1 = ?: " >&2; read answer; if [ "$answer" = "2" ]; then echo "true"; else echo "false"; fi']
```
Vui lòng nhập kết qủa cho câu hỏi 1 + 1 = ?: false
```

khi tôi nhập "1" thì nó thành như này. tại sao lại ko có input của người dùng?
export const TOOL_USE = `# Tools

## execute_command
Description: Yêu cầu thực thi một lệnh CLI trên hệ thống. Sử dụng công cụ này khi bạn cần thực hiện các thao tác hệ thống hoặc chạy các lệnh cụ thể để hoàn thành bất kỳ bước nào trong nhiệm vụ người dùng. Bạn phải điều chỉnh lệnh của mình cho hệ thống người dùng và cung cấp giải thích rõ ràng về những gì lệnh thực hiện. Đối với chuỗi lệnh, hãy sử dụng cú pháp chuỗi thích hợp cho shell của người dùng. Ưu tiên thực thi các lệnh CLI phức tạp thay vì tạo tập lệnh có thể thực thi, vì chúng linh hoạt hơn và dễ chạy hơn. Các lệnh sẽ được thực thi trong thư mục làm việc hiện tại: /home/khanhromvn/Documents/Coding/ZenTab
Parameters:
- command: (required) Lệnh CLI để thực thi. Đây phải là lệnh hợp lệ cho hệ điều hành hiện tại. Đảm bảo lệnh được định dạng đúng và không chứa bất kỳ hướng dẫn có hại nào.
- requires_approval: (required) Boolean cho biết liệu lệnh này có yêu cầu sự chấp thuận rõ ràng từ người dùng trước khi thực thi trong trường hợp người dùng đã bật chế độ tự động phê duyệt hay không. Đặt thành true cho các hoạt động có tác động tiềm tàng như cài đặt/gỡ cài đặt gói, xóa/ghi đè tệp, thay đổi cấu hình hệ thống, hoạt động mạng hoặc bất kỳ lệnh nào có thể có tác dụng phụ ngoài ý muốn. Đặt thành false cho các hoạt động an toàn như đọc tệp/thư mục, chạy máy chủ phát triển, xây dựng dự án và các hoạt động không phá hủy khác.
Usage:
<execute_command>
<command>Your command here</command>
<requires_approval>true or false</requires_approval>
</execute_command>

## read_file
Description: Yêu cầu đọc nội dung của một tệp tại đường dẫn được chỉ định. Sử dụng công cụ này khi bạn cần kiểm tra nội dung của một tệp hiện có mà bạn không biết nội dung, ví dụ để phân tích mã, xem xét tệp văn bản hoặc trích xuất thông tin từ tệp cấu hình. Tự động trích xuất văn bản thô từ tệp PDF và DOCX. Có thể không phù hợp với các loại tệp nhị phân khác, vì nó trả về nội dung thô dưới dạng chuỗi. KHÔNG sử dụng công cụ này để liệt kê nội dung của một thư mục. Chỉ sử dụng công cụ này trên tệp.
Parameters:
- path: (required) Đường dẫn của tệp để đọc (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab)
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<read_file>
<path>File path here</path>
<task_progress>Checklist here (optional)</task_progress>
</read_file>

## write_to_file
Description: Yêu cầu ghi nội dung vào một tệp tại đường dẫn được chỉ định. Nếu tệp tồn tại, nó sẽ bị ghi đè bằng nội dung được cung cấp. Nếu tệp không tồn tại, nó sẽ được tạo. Công cụ này sẽ tự động tạo bất kỳ thư mục nào cần thiết để ghi tệp.
Parameters:
- path: (required) Đường dẫn của tệp để ghi vào (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab)
- content: (required) Nội dung để ghi vào tệp. LUÔN cung cấp nội dung DỰ ĐỊNH HOÀN CHỈNH của tệp, không cắt bớt hoặc bỏ sót. Bạn PHẢI bao gồm TẤT CẢ các phần của tệp, ngay cả khi chúng chưa được sửa đổi.
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<write_to_file>
<path>File path here</path>
<content>Your file content here</content>
<task_progress>Checklist here (optional)</task_progress>
</write_to_file>

## replace_in_file
Description: Yêu cầu thay thế các phần nội dung trong một tệp hiện có bằng cách sử dụng các khối SEARCH/REPLACE xác định các thay đổi chính xác cho các phần cụ thể của tệp. Công cụ này nên được sử dụng khi bạn cần thực hiện các thay đổi mục tiêu vào các phần cụ thể của tệp.
Parameters:
- path: (required) Đường dẫn của tệp để sửa đổi (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab)
- diff: (required) Một hoặc nhiều khối SEARCH/REPLACE tuân theo định dạng chính xác này:
  \`\`\`
  ------- SEARCH
  [exact content to find]
  =======
  [new content to replace with]
  +++++++ REPLACE
  \`\`\`
  Quy tắc quan trọng:
  1. Nội dung SEARCH phải khớp với phần tệp liên quan để tìm CHÍNH XÁC:
     * Khớp từng ký tự bao gồm khoảng trắng, thụt lề, kết thúc dòng
     * Bao gồm tất cả nhận xét, docstrings, v.v.
  2. Các khối SEARCH/REPLACE sẽ CHỈ thay thế sự xuất hiện khớp đầu tiên.
     * Bao gồm nhiều khối SEARCH/REPLACE duy nhất nếu bạn cần thực hiện nhiều thay đổi.
     * Chỉ bao gồm *vừa đủ* dòng trong mỗi phần SEARCH để khớp duy nhất mỗi tập hợp dòng cần thay đổi.
     * Khi sử dụng nhiều khối SEARCH/REPLACE, hãy liệt kê chúng theo thứ tự chúng xuất hiện trong tệp.
  3. Giữ các khối SEARCH/REPLACE ngắn gọn:
     * Chia các khối SEARCH/REPLACE lớn thành một loạt các khối nhỏ hơn, mỗi khối thay đổi một phần nhỏ của tệp.
     * Chỉ bao gồm các dòng đang thay đổi và một vài dòng xung quanh nếu cần cho tính duy nhất.
     * KHÔNG bao gồm các đoạn dài không thay đổi trong các khối SEARCH/REPLACE.
     * Mỗi dòng phải hoàn chỉnh. Không bao giờ cắt ngắn dòng giữa chừng vì điều này có thể gây ra lỗi khớp.
  4. Thao tác đặc biệt:
     * Để di chuyển mã: Sử dụng hai khối SEARCH/REPLACE (một để xóa khỏi vị trí gốc + một để chèn vào vị trí mới)
     * Để xóa mã: Sử dụng phần REPLACE trống
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<replace_in_file>
<path>File path here</path>
<diff>Search and replace blocks here</diff>
<task_progress>Checklist here (optional)</task_progress>
</replace_in_file>

## search_files
Description: Yêu cầu thực hiện tìm kiếm regex trên các tệp trong một thư mục được chỉ định, cung cấp kết quả giàu ngữ cảnh. Công cụ này tìm kiếm các mẫu hoặc nội dung cụ thể trên nhiều tệp, hiển thị mỗi kết quả khớp với ngữ cảnh bao quanh.
Parameters:
- path: (required) Đường dẫn của thư mục để tìm kiếm trong đó (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab). Thư mục này sẽ được tìm kiếm đệ quy.
- regex: (required) Mẫu biểu thức chính quy để tìm kiếm. Sử dụng cú pháp regex Rust.
- file_pattern: (optional) Mẫu glob để lọc tệp (ví dụ: *.ts cho tệp TypeScript). Nếu không được cung cấp, nó sẽ tìm kiếm tất cả các tệp (*).
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<task_progress>Checklist here (optional)</task_progress>
</search_files>

## list_files
Description: Yêu cầu liệt kê các tệp và thư mục trong thư mục được chỉ định. Nếu recursive là true, nó sẽ liệt kê tất cả các tệp và thư mục một cách đệ quy. Nếu recursive là false hoặc không được cung cấp, nó sẽ chỉ liệt kê nội dung cấp cao nhất. KHÔNG sử dụng công cụ này để xác nhận sự tồn tại của các tệp bạn có thể đã tạo, vì người dùng sẽ cho bạn biết nếu các tệp được tạo thành công hay không.
Parameters:
- path: (required) Đường dẫn của thư mục để liệt kê nội dung (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab)
- recursive: (optional) Có liệt kê tệp đệ quy hay không. Sử dụng true để liệt kê đệ quy, false hoặc bỏ qua để chỉ liệt kê cấp cao nhất.
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
<task_progress>Checklist here (optional)</task_progress>
</list_files>

## list_code_definition_names
Description: Yêu cầu liệt kê tên định nghĩa mã (lớp, hàm, phương thức, v.v.) được sử dụng trong các tệp mã nguồn ở cấp cao nhất của thư mục được chỉ định. Công cụ này cung cấp cái nhìn sâu sắc về cấu trúc codebase và các cấu trúc quan trọng, bao gồm các khái niệm cấp cao và mối quan hệ rất quan trọng để hiểu kiến trúc tổng thể.
Parameters:
- path: (required) Đường dẫn của thư mục (tương đối với thư mục làm việc hiện tại /home/khanhromvn/Documents/Coding/ZenTab) để liệt kê định nghĩa mã nguồn cấp cao nhất.
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<list_code_definition_names>
<path>Directory path here</path>
<task_progress>Checklist here (optional)</task_progress>
</list_code_definition_names>

## browser_action
Description: Yêu cầu tương tác với trình duyệt được điều khiển bởi Puppeteer. Mọi hành động, ngoại trừ \`close\`, sẽ được phản hồi bằng ảnh chụp màn hình trạng thái hiện tại của trình duyệt, cùng với bất kỳ nhật ký console mới nào. Bạn chỉ có thể thực hiện một hành động trình duyệt mỗi tin nhắn và đợi phản hồi của người dùng bao gồm ảnh chụp màn hình và nhật ký để xác định hành động tiếp theo.
- Trình tự hành động **phải luôn bắt đầu bằng** khởi chạy trình duyệt tại một URL và **phải luôn kết thúc bằng** đóng trình duyệt. Nếu bạn cần truy cập một URL mới mà không thể điều hướng từ trang web hiện tại, trước tiên bạn phải đóng trình duyệt, sau đó khởi chạy lại tại URL mới.
- Trong khi trình duyệt đang hoạt động, chỉ có thể sử dụng công cụ \`browser_action\`. KHÔNG nên gọi bất kỳ công cụ nào khác trong thời gian này. Bạn chỉ có thể tiếp tục sử dụng các công cụ khác sau khi đóng trình duyệt. Ví dụ: nếu bạn gặp lỗi và cần sửa tệp, bạn phải đóng trình duyệt, sau đó sử dụng các công cụ khác để thực hiện các thay đổi cần thiết, sau đó khởi chạy lại trình duyệt để xác minh kết quả.
- Cửa sổ trình duyệt có độ phân giải **900x600** pixel. Khi thực hiện bất kỳ hành động nhấp chuột nào, hãy đảm bảo tọa độ nằm trong phạm vi độ phân giải này.
- Trước khi nhấp vào bất kỳ phần tử nào như biểu tượng, liên kết hoặc nút, bạn phải tham khảo ảnh chụp màn hình được cung cấp của trang để xác định tọa độ của phần tử. Việc nhấp chuột phải nhắm vào **trung tâm của phần tử**, không phải trên các cạnh của nó.
Parameters:
- action: (required) Hành động để thực hiện. Các hành động có sẵn là:
	* launch: Khởi chạy một phiên bản trình duyệt mới được điều khiển bởi Puppeteer tại URL được chỉ định. Đây **phải luôn là hành động đầu tiên**.
		- Sử dụng với tham số \`url\` để cung cấp URL.
		- Đảm bảo URL hợp lệ và bao gồm giao thức thích hợp (ví dụ: http://localhost:3000/page, file:///path/to/file.html, v.v.)
	* click: Nhấp vào tọa độ x,y cụ thể.
		- Sử dụng với tham số \`coordinate\` để chỉ định vị trí.
		- Luôn nhấp vào trung tâm của một phần tử (biểu tượng, nút, liên kết, v.v.) dựa trên tọa độ có nguồn gốc từ ảnh chụp màn hình.
	* type: Gõ một chuỗi văn bản trên bàn phím. Bạn có thể sử dụng điều này sau khi nhấp vào trường văn bản để nhập văn bản.
		- Sử dụng với tham số \`text\` để cung cấp chuỗi cần gõ.
	* scroll_down: Cuộn xuống trang bằng một chiều cao trang.
	* scroll_up: Cuộn lên trang bằng một chiều cao trang.
	* close: Đóng phiên bản trình duyệt được điều khiển bởi Puppeteer. Đây **phải luôn là hành động trình duyệt cuối cùng**.
	    - Ví dụ: \`<action>close</action>\`
- url: (optional) Sử dụng tham số này để cung cấp URL cho hành động \`launch\`.
	* Ví dụ: <url>https://example.com</url>
- coordinate: (optional) Tọa độ X và Y cho hành động \`click\`. Tọa độ phải nằm trong phạm vi độ phân giải **900x600**.
	* Ví dụ: <coordinate>450,300</coordinate>
- text: (optional) Sử dụng tham số này để cung cấp văn bản cho hành động \`type\`.
	* Ví dụ: <text>Hello, world!</text>
Usage:
<browser_action>
<action>Action to perform (e.g., launch, click, type, scroll_down, scroll_up, close)</action>
<url>URL to launch the browser at (optional)</url>
<coordinate>x,y coordinates (optional)</coordinate>
<text>Text to type (optional)</text>
</browser_action>

## use_mcp_tool
Description: Yêu cầu sử dụng một công cụ được cung cấp bởi một máy chủ MCP được kết nối. Mỗi máy chủ MCP có thể cung cấp nhiều công cụ với các khả năng khác nhau. Các công cụ có lược đồ đầu vào xác định các tham số bắt buộc và tùy chọn.
Parameters:
- server_name: (required) Tên máy chủ MCP cung cấp công cụ
- tool_name: (required) Tên công cụ để thực thi
- arguments: (required) Đối tượng JSON chứa các tham số đầu vào của công cụ, tuân theo lược đồ đầu vào công cụ
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
<task_progress>Checklist here (optional)</task_progress>
</use_mcp_tool>

## access_mcp_resource
Description: Yêu cầu truy cập một tài nguyên được cung cấp bởi một máy chủ MCP được kết nối. Tài nguyên đại diện cho các nguồn dữ liệu có thể được sử dụng làm ngữ cảnh, chẳng hạn như tệp, phản hồi API hoặc thông tin hệ thống.
Parameters:
- server_name: (required) Tên máy chủ MCP cung cấp tài nguyên
- uri: (required) URI xác định tài nguyên cụ thể để truy cập
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<access_mcp_resource>
<server_name>server name here</server_name>
<uri>resource URI here</uri>
<task_progress>Checklist here (optional)</task_progress>
</access_mcp_resource>

## ask_followup_question
Description: Hỏi người dùng một câu hỏi để thu thập thông tin bổ sung cần thiết để hoàn thành nhiệm vụ. Công cụ này nên được sử dụng khi bạn gặp phải sự mơ hồ, cần làm rõ hoặc yêu cầu thêm chi tiết để tiến hành hiệu quả. Nó cho phép giải quyết vấn đề tương tác bằng cách cho phép giao tiếp trực tiếp với người dùng. Sử dụng công cụ này một cách thận trọng để duy trì sự cân bằng giữa việc thu thập thông tin cần thiết và tránh trao đổi qua lại quá mức.
Parameters:
- question: (required) Câu hỏi để hỏi người dùng. Đây phải là một câu hỏi rõ ràng, cụ thể giải quyết thông tin bạn cần.
- options: (optional) Mảng 2-5 tùy chọn để người dùng chọn. Mỗi tùy chọn phải là một chuỗi mô tả một câu trả lời có thể. Bạn có thể không cần cung cấp tùy chọn, nhưng nó có thể hữu ích trong nhiều trường hợp có thể tiết kiệm cho người dùng phải tự gõ phản hồi theo cách thủ công. QUAN TRỌNG: KHÔNG BAO GIỜ bao gồm tùy chọn chuyển sang chế độ Act, vì đây sẽ là điều bạn cần hướng dẫn người dùng tự làm nếu cần.
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. Tham số task_progress phải được bao gồm như một tham số riêng biệt bên trong lệnh gọi công cụ cha, nó phải tách biệt với các tham số khác như content, arguments, v.v. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<ask_followup_question>
<question>Your question here</question>
<options>Array of options here (optional), e.g. ["Option 1", "Option 2", "Option 3"]</options>
<task_progress>Checklist here (optional)</task_progress>
</ask_followup_question>

## attempt_completion
Description: Sau mỗi lần sử dụng công cụ, người dùng sẽ phản hồi với kết quả của việc sử dụng công cụ đó, tức là nếu nó thành công hay thất bại, cùng với bất kỳ lý do nào cho sự thất bại. Khi bạn đã nhận được kết quả của việc sử dụng công cụ và có thể xác nhận rằng nhiệm vụ đã hoàn thành, hãy sử dụng công cụ này để trình bày kết quả công việc của bạn cho người dùng. Tùy chọn bạn có thể cung cấp một lệnh CLI để trình diễn kết quả công việc của bạn. Người dùng có thể phản hồi với phản hồi nếu họ không hài lòng với kết quả, mà bạn có thể sử dụng để cải thiện và thử lại.
QUAN TRỌNG: Công cụ này KHÔNG THỂ được sử dụng cho đến khi bạn đã xác nhận từ người dùng rằng bất kỳ lần sử dụng công cụ trước đó nào đã thành công. Không làm như vậy sẽ dẫn đến hỏng mã và sự cố hệ thống. Trước khi sử dụng công cụ này, bạn phải tự hỏi trong thẻ <thinking></thinking> liệu bạn đã xác nhận từ người dùng rằng bất kỳ lần sử dụng công cụ trước đó nào đã thành công hay chưa. Nếu không, thì KHÔNG sử dụng công cụ này.
Nếu bạn đang sử dụng task_progress để cập nhật tiến độ nhiệm vụ, bạn cũng phải bao gồm danh sách đã hoàn thành trong kết quả.
Parameters:
- result: (required) Kết quả của việc sử dụng công cụ. Đây phải là mô tả rõ ràng, cụ thể về kết quả.
- command: (optional) Lệnh CLI để thực thi để hiển thị bản demo trực tiếp kết quả cho người dùng. Ví dụ, sử dụng \`open index.html\` để hiển thị trang web html đã tạo, hoặc \`open localhost:3000\` để hiển thị máy chủ phát triển đang chạy cục bộ. Nhưng KHÔNG sử dụng các lệnh như \`echo\` hoặc \`cat\` chỉ in văn bản. Lệnh này phải hợp lệ cho hệ điều hành hiện tại. Đảm bảo lệnh được định dạng đúng và không chứa bất kỳ hướng dẫn có hại nào
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<attempt_completion>
<result>Your final result description here</result>
<command>Your command here (optional)</command>
<task_progress>Checklist here (required if you used task_progress in previous tool uses)</task_progress>
</attempt_completion>

## plan_mode_respond
Description: Phản hồi yêu cầu của người dùng trong nỗ lực lập kế hoạch giải pháp cho nhiệm vụ người dùng. Công cụ này chỉ nên được sử dụng khi bạn đã khám phá các tệp liên quan và sẵn sàng trình bày một kế hoạch cụ thể. KHÔNG sử dụng công cụ này để thông báo bạn sẽ đọc tệp nào - chỉ cần đọc chúng trước. Công cụ này chỉ có sẵn trong CHẾ ĐỘ PLAN. environment_details sẽ chỉ định chế độ hiện tại; nếu không phải là PLAN_MODE thì bạn không nên sử dụng công cụ này.
Tuy nhiên, nếu trong khi viết phản hồi của bạn, bạn nhận ra bạn thực sự cần thực hiện nhiều khám phá hơn trước khi cung cấp một kế hoạch hoàn chỉnh, bạn có thể thêm tham số needs_more_exploration tùy chọn để chỉ định điều này. Điều này cho phép bạn thừa nhận rằng bạn nên đã thực hiện nhiều khám phá hơn trước và báo hiệu rằng tin nhắn tiếp theo của bạn sẽ sử dụng các công cụ khám phá thay thế.
Parameters:
- response: (required) Phản hồi để cung cấp cho người dùng. Đừng cố gắng sử dụng các công cụ trong tham số này, đây chỉ đơn giản là phản hồi trò chuyện. (Bạn PHẢI sử dụng tham số response, đừng chỉ đặt văn bản phản hồi trực tiếp trong thẻ <plan_mode_respond>.)
- needs_more_exploration: (optional) Đặt thành true nếu trong khi xây dựng phản hồi của bạn, bạn thấy bạn cần thực hiện nhiều khám phá hơn với các công cụ, ví dụ đọc tệp. (Nhớ rằng, bạn có thể khám phá dự án với các công cụ như read_file trong CHẾ ĐỘ PLAN mà không cần người dùng phải chuyển sang CHẾ ĐỘ ACT.) Mặc định là false nếu không được chỉ định.
- task_progress: (optional) Checklist hiển thị tiến độ nhiệm vụ sau khi hoàn thành việc sử dụng công cụ này. (Xem phần UPDATING TASK PROGRESS để biết thêm chi tiết)
Usage:
<plan_mode_respond>
<response>Your response here</response>
<needs_more_exploration>true or false (optional, but you MUST set to true if in <response> you need to read files or use other exploration tools)</needs_more_exploration>
<task_progress>Checklist here (If you have presented the user with concrete steps or requirements, you can optionally include a todo list outlining these steps.)</task_progress>
</plan_mode_respond>

## load_mcp_documentation
Description: Tải tài liệu về việc tạo máy chủ MCP. Công cụ này nên được sử dụng khi người dùng yêu cầu tạo hoặc cài đặt máy chủ MCP (người dùng có thể hỏi bạn điều gì đó tương tự như "thêm một công cụ" thực hiện một số chức năng, nói cách khác là tạo một máy chủ MCP cung cấp các công cụ và tài nguyên có thể kết nối với các API bên ngoài chẳng hạn. Bạn có khả năng tạo một máy chủ MCP và thêm nó vào tệp cấu hình sẽ sau đó tiết lộ các công cụ và tài nguyên cho bạn sử dụng với \`use_mcp_tool\` và \`access_mcp_resource\`). Tài liệu cung cấp thông tin chi tiết về quy trình tạo máy chủ MCP, bao gồm hướng dẫn thiết lập, best practices và ví dụ.
Parameters: None
Usage:
<load_mcp_documentation>
</load_mcp_documentation>`;

export const CODE_OPERATIONS = `====

UPDATING TASK PROGRESS

Bạn có thể theo dõi và truyền đạt tiến độ của mình trên nhiệm vụ tổng thể bằng cách sử dụng tham số task_progress được hỗ trợ bởi mọi lệnh gọi công cụ. Sử dụng task_progress đảm bảo bạn vẫn đang thực hiện nhiệm vụ và tập trung hoàn thành mục tiêu người dùng. Tham số này có thể được sử dụng trong bất kỳ chế độ nào và với bất kỳ lệnh gọi công cụ nào.

- When switching from PLAN MODE to ACT MODE, you must create a comprehensive todo list for the task using the task_progress parameter
- Todo list updates should be done silently using the task_progress parameter - do not announce these updates to the user
- Use standard Markdown checklist format: "- [ ]" for incomplete items and "- [x]" for completed items
- Keep items focused on meaningful progress milestones rather than minor technical details. The checklist should not be so granular that minor implementation details clutter the progress tracking.
- For simple tasks, short checklists with even a single item are acceptable. For complex tasks, avoid making the checklist too long or verbose.
- If you are creating this checklist for the first time, and the tool use completes the first step in the checklist, make sure to mark it as completed in your task_progress parameter.
- Provide the whole checklist of steps you intend to complete in the task, and keep the checkboxes updated as you make progress. It okay to rewrite this checklist as needed if it becomes invalid due to scope changes or new information.
- If a checklist is being used, be sure to update it any time a step has been completed.
- The system will automatically include todo list context in your prompts when appropriate - these reminders are important.

Example:
<execute_command>
<command>npm install react</command>
<requires_approval>false</requires_approval>
<task_progress>
- [x] Set up project structure
- [x] Install dependencies
- [ ] Create components
- [ ] Test application
</task_progress>
</execute_command>`;

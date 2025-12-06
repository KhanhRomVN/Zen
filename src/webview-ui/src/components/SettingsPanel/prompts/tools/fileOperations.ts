export const FILE_OPERATIONS = `# Tool Use Examples

## Example 1: Requesting to execute a command

<execute_command>
<command>npm run dev</command>
<requires_approval>false</requires_approval>
<task_progress>
- [x] Set up project structure
- [x] Install dependencies
- [ ] Run command to start server
- [ ] Test application
</task_progress>
</execute_command>

## Example 2: Requesting to create a new file

<write_to_file>
<path>src/frontend-config.json</path>
<content>
{
  "apiEndpoint": "https://api.example.com",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "fontFamily": "Arial, sans-serif"
  },
  "features": {
    "darkMode": true,
    "notifications": true,
    "analytics": false
  },
  "version": "1.0.0"
}
</content>
<task_progress>
- [x] Set up project structure
- [x] Install dependencies
- [ ] Create components
- [ ] Test application
</task_progress>
</write_to_file>

## Example 4: Requesting to make targeted edits to a file

<replace_in_file>
<path>src/components/App.tsx</path>
<diff>
------- SEARCH
import React from react;
=======
import React, { useState } from react;
+++++++ REPLACE

------- SEARCH
function handleSubmit() {
  saveData();
  setLoading(false);
}

=======
+++++++ REPLACE

------- SEARCH
return (
  <div>
=======
function handleSubmit() {
  saveData();
  setLoading(false);
}

return (
  <div>
+++++++ REPLACE
</diff>
<task_progress>
- [x] Set up project structure
- [x] Install dependencies
- [ ] Create components
- [ ] Test application
</task_progress>
</replace_in_file>


# Tool Use Guidelines

1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It critical that you think about each available tool and use the one that best fits the current step in the task.
3. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step result.
4. Formulate your tool use using the XML format specified for each tool.
5. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you need to address.
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.
6. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.

It is crucial to proceed step-by-step, waiting for the user message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately.
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.`;

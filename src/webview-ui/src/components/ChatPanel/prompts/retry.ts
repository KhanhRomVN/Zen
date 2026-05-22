/**
 * Generates the self-healing diagnostic prompt when a task retry is triggered due to a connection or execution error.
 * This instructs the AI to inspect the state of recently manipulated files and attempt to heal/resume the task.
 */
export const buildRetryPrompt = (errorText: string, operatedFiles: string[]): string => {
  const filesList = operatedFiles.map((f) => `\`${f}\``).join(", ");
  
  let prompt = `An execution or connection error occurred during the task execution (Error Detail: "${errorText}").`;
  prompt += `\n\nPlease diagnose the current workspace state to heal and resume the task.`;
  
  if (operatedFiles.length > 0) {
    prompt += `\n\n1. Use the \`read_file\` tool to read and inspect the following files you were recently working on to determine their current content and state: ${filesList}`;
    prompt += `\n2. Based on the inspection, identify where the execution was interrupted or what went wrong.`;
    prompt += `\n3. Resume and re-execute the failed actions to complete the requested task successfully.`;
  } else {
    prompt += `\n\n1. Check the files you were recently working on to understand the current workspace state.`;
    prompt += `\n2. Re-evaluate what needs to be done and re-execute the failed action/task to continue.`;
  }
  
  return prompt;
};

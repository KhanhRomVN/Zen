const toolPatterns = [
  "read_file",
  "write_to_file",
  "replace_in_file",
  "run_command",
  "list_files",
  "search_files",
  "execute_agent_action",
  "code",
  "file",
  "markdown",
  "question",
];

const fixMissingBracket = (content) => {
  let remainingContent = content;
  const toolNamesPattern = toolPatterns.join("|");
  const missingBracketRegex = new RegExp(
    `^(\\s*(?:•\\s*)?)(${toolNamesPattern})>`,
    "i",
  );
  if (missingBracketRegex.test(remainingContent)) {
    remainingContent = remainingContent.replace(
      missingBracketRegex,
      "$1<$2>",
    );
  }
  return remainingContent;
};

console.log(fixMissingBracket("read_file><file_path>README.md</file_path></read_file>"));
console.log(fixMissingBracket("• read_file><file_path>README.md</file_path></read_file>"));
console.log(fixMissingBracket("  read_file><file_path>README.md</file_path></read_file>"));
console.log(fixMissingBracket("read_file")); // should not fix yet (no >)
console.log(fixMissingBracket("some other text before read_file><file_path>README.md</file_path></read_file>")); // should not fix (not at start)

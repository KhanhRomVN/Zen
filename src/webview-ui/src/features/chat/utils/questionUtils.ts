export function isQuestionFullyAnswered(
  selectedOption?: string | null,
): boolean {
  if (!selectedOption) return false;
  try {
    const parsed = JSON.parse(selectedOption);
    if (
      parsed &&
      typeof parsed === "object" &&
      "questionId" in parsed &&
      parsed.allAnswered !== true
    ) {
      return false;
    }
  } catch (e) {}
  return true;
}
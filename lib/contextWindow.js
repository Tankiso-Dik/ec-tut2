export function normalizeHistory(history, windowSize = 12) {
  if (!Array.isArray(history)) {
    return [];
  }

  const cleaned = history
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content || "").trim()
    }))
    .filter((entry) => entry.content.length > 0);

  return cleaned.slice(-windowSize);
}

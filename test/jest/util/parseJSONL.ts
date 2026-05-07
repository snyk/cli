/**
 * Parses JSON Lines: one JSON value per line. Lines that are not valid JSON are skipped.
 */
export function parseJSONL(jsonl: string): unknown[] {
  const lines: string[] = jsonl.trim().split('\n').filter(Boolean);

  const result: unknown[] = [];
  for (const line of lines) {
    try {
      result.push(JSON.parse(line.trim()));
    } catch {
      // Skip non-JSON lines
    }
  }
  return result;
}

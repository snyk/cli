// eslint-disable-next-line @typescript-eslint/no-var-requires
const stripAnsi = require('strip-ansi');

// Marks a transient retry notification. A terminal failure (retries exhausted)
// lacks this line, so we can strip only recovered retries.
const RETRY_MARKER = /Automatically retrying in/;

// Header line of a rendered SNYK-0001 block (WARN or ERROR variant).
const BLOCK_HEADER =
  /(?:WARN|ERROR)\b.*\(SNYK-0001\)|Service temporarily throttled \(SNYK-0001\)/i;

// Trailing "Docs:" line that closes a rendered SNYK-0001 block.
const DOCS_LINE = /^\s*Docs:\s*https?:\/\/\S*snyk-0001/i;

/**
 * Removes transient rate-limit retry notifications from a captured stderr.
 *
 * Block-scoped and marker-gated: a SNYK-0001 block is stripped only when it
 * contains the "Automatically retrying in" line, so a genuine post-retry
 * failure is preserved and still surfaces in tests.
 */
export function stripRetryWarnings(stderr: string): string {
  if (!stderr) {
    return stderr;
  }

  // Gate: only touch stderr that contains a transient retry notification.
  if (!RETRY_MARKER.test(stripAnsi(stderr))) {
    return stderr;
  }

  const lines = stderr.split('\n');
  const clean = lines.map((line) => stripAnsi(line));
  const keep: boolean[] = new Array(lines.length).fill(true);

  let i = 0;
  while (i < lines.length) {
    if (!BLOCK_HEADER.test(clean[i])) {
      i++;
      continue;
    }

    // Find the extent of this block: ends at its Docs line or the next header.
    let end = i;
    let hasRetryMarker = false;
    for (let j = i; j < lines.length; j++) {
      if (RETRY_MARKER.test(clean[j])) {
        hasRetryMarker = true;
      }
      if (j > i && BLOCK_HEADER.test(clean[j])) {
        end = j - 1;
        break;
      }
      end = j;
      if (DOCS_LINE.test(clean[j])) {
        break;
      }
    }

    if (hasRetryMarker) {
      for (let k = i; k <= end; k++) {
        keep[k] = false;
      }
    }

    i = end + 1;
  }

  const filtered = lines.filter((_, idx) => keep[idx]);

  // Drop blank lines left dangling at the edges by removed blocks.
  while (filtered.length > 0 && filtered[0].trim() === '') {
    filtered.shift();
  }
  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === '') {
    filtered.pop();
  }

  return filtered.join('\n');
}

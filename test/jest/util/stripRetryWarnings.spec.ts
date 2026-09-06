import { stripRetryWarnings } from './stripRetryWarnings';

// A recovered retry notification. Trailing middle dots (·) mimic the renderer
// padding to verify the matcher tolerates it.
const makeRetryBlock = (attempt = 1, total = 3): string =>
  [
    ' WARN    Service temporarily throttled (SNYK-0001)······························',
    `           Automatically retrying in 60 seconds... (attempt ${attempt}/${total}).··············`,
    ' Status:  429 Too Many Requests·',
    ' Docs:    https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-0001··········',
  ].join('\n');

const retryBlock = makeRetryBlock(1, 3);

// A terminal SNYK-0001 failure (retries exhausted): includes the description
// line but no retry marker, so it must always be preserved.
const terminalThrottleBlock = [
  ' ERROR   Service temporarily throttled (SNYK-0001)······························',
  '           The request rate limit has been exceeded. Wait a few minutes, then try again.',
  ' Status:  429 Too Many Requests·',
  ' Docs:    https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-0001··········',
].join('\n');

describe('stripRetryWarnings', () => {
  it('removes a single transient retry block (a)', () => {
    const stderr = `\n${retryBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe('');
  });

  it('removes multiple stacked transient retry blocks (b)', () => {
    const stderr = `\n${retryBlock}\n${retryBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe('');
  });

  it('removes a retry block regardless of the attempt counter (e.g. 2/3)', () => {
    const stderr = `\n${makeRetryBlock(2, 3)}\n`;
    expect(stripRetryWarnings(stderr)).toBe('');
  });

  it('removes a realistic 1/3 -> 2/3 -> success sequence', () => {
    // Two backed-off attempts, then success: nothing else on stderr.
    const stderr = `\n${makeRetryBlock(1, 3)}\n${makeRetryBlock(2, 3)}\n`;
    expect(stripRetryWarnings(stderr)).toBe('');
  });

  it('leaves a real error without the retry marker unchanged (c)', () => {
    const stderr = ' ERROR   Something else went wrong (SNYK-CLI-1234)\n';
    expect(stripRetryWarnings(stderr)).toBe(stderr);
  });

  it('keeps only the trailing real error when mixed with a retry block (d)', () => {
    const realError = ' ERROR   Something else went wrong (SNYK-CLI-1234)';
    const stderr = `\n${retryBlock}\n\n${realError}\n`;
    expect(stripRetryWarnings(stderr)).toBe(realError);
  });

  it('preserves a terminal post-retry failure block (safeguard) (e)', () => {
    // Gate triggered by the recovered retry, but the terminal failure survives.
    const stderr = `\n${retryBlock}\n\n${terminalThrottleBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe(terminalThrottleBlock);
  });

  it('preserves the terminal failure after a 1/3 -> 2/3 -> fail sequence', () => {
    // Retries exhausted: notifications stripped, terminal failure stays.
    const stderr = `\n${makeRetryBlock(1, 3)}\n${makeRetryBlock(
      2,
      3,
    )}\n\n${terminalThrottleBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe(terminalThrottleBlock);
  });

  it('leaves a standalone terminal failure (no retry anywhere) verbatim', () => {
    const stderr = `\n${terminalThrottleBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe(stderr);
  });

  it('leaves empty and ordinary stderr unchanged (f)', () => {
    expect(stripRetryWarnings('')).toBe('');
    const ordinary = 'some unrelated diagnostic output\n';
    expect(stripRetryWarnings(ordinary)).toBe(ordinary);
  });

  it('tolerates ANSI color codes around the rendered block', () => {
    const ansiRetryBlock = [
      '\u001b[33m WARN    Service temporarily throttled (SNYK-0001)\u001b[39m',
      '\u001b[33m           Automatically retrying in 60 seconds... (attempt 1/3).\u001b[39m',
      '\u001b[33m Status:  429 Too Many Requests\u001b[39m',
      '\u001b[33m Docs:    https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-0001\u001b[39m',
    ].join('\n');
    const stderr = `\n${ansiRetryBlock}\n`;
    expect(stripRetryWarnings(stderr)).toBe('');
  });
});

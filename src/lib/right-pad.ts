export function rightPadWithSpaces(s: string, padding: number) {
  const padLength = padding - s.length;
  if (padLength <= 0) {
    return s;
  }

  return s + ' '.repeat(padLength);
}

export function deQuote(s: string): string {
  let res = s;

  if (res.startsWith('"') && res.endsWith('"')) {
    res = res.substring(1, res.length - 1);
  }

  if (res.startsWith("'") && res.endsWith("'")) {
    res = res.substring(1, res.length - 1);
  }

  return res;
}

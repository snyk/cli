export function abridgeErrorMessage(
  msg: string,
  maxLen: number,
  ellipsis?: string,
): string {
  if (msg.length <= maxLen) {
    return msg;
  }
  const e = ellipsis || ' ... ';
  const toKeep = (maxLen - e.length) / 2;
  return msg.slice(0, toKeep) + e + msg.slice(msg.length - toKeep, msg.length);
}

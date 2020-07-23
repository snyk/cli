export function abridgeErrorMessage(
  msg: string,
  maxLen: number,
  ellipsis = ' ... ',
): string {
  if (msg.length <= maxLen) {
    return msg;
  }
  const toKeep = Math.floor((maxLen - ellipsis.length) / 2);
  return (
    msg.slice(0, toKeep) + ellipsis + msg.slice(msg.length - toKeep, msg.length)
  );
}

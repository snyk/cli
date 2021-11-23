export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const reTryMessage =
  'Tip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>';
export const contactSupportMessage =
  'If the issue persists contact support@snyk.io';

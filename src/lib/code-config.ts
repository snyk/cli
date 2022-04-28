import config from './config';
import { config as userConfig } from './user-config';

export function getCodeClientProxyUrl() {
  const url = new URL(config.API);
  const domain = url.origin;
  return (
    config.CODE_CLIENT_PROXY_URL ||
    domain.replace(/\/\/(app\.)?/, '//deeproxy.')
  );
}

export function getBase64Encoding(
  enabled = userConfig.get('use-base64-encoding'),
): boolean {
  if (enabled) {
    return enabled.toLowerCase() === 'true';
  }
  return false;
}

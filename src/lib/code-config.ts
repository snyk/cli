import config from './config';

export function getCodeClientProxyUrl() {
  const url = new URL(config.API);
  const domain = url.origin;
  return (
    config.CODE_CLIENT_PROXY_URL ||
    domain.replace(/\/\/(app\.)?/, '//deeproxy.')
  );
}

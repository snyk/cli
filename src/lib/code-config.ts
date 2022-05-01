import config from './config';

export function getCodeClientProxyUrl() {
  return (
    config.CODE_CLIENT_PROXY_URL ||
    config.API.replace(/snyk\.io.*/, 'snyk.io').replace(
      /\/\/(app\.)?/,
      '//deeproxy.',
    )
  );
}

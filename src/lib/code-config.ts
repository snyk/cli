import config from './config';

export function getCodeClientProxyUrl(): string {
  const url = new URL(config.API);
  const domain = url.origin;
  const routeToAPI = isFedramp(domain);
  return (
    config.CODE_CLIENT_PROXY_URL ||
    domain.replace(/\/\/(ap[pi]\.)?/, routeToAPI ? '//api.' : '//deeproxy.')
  );
}

function isFedramp(domain: string): boolean {
  return domain.includes('snykgov.io');
}

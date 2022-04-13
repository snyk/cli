import * as ci from 'ci-info';

export function isCI(): boolean {
  return ci.isCI;
}

export function getCIName(): string {
  return ci.name || '';
}

export function isPullRequest(): boolean {
  return ci.isPR || false;
}

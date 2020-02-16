import * as Debug from 'debug';
const debug = Debug('snyk');

const oneDay = 1000 * 60 * 60 * 24;

export interface IgnoreRule {
  vulnId: string;
  reason: string;
  expires: string;
}

export interface IgnoreRulePerPath {
  [ignorePath: string]: IgnoreRule;
}

export function generateIgnoreRule(
  vulnId: string,
  reason: string,
  expiryDate = generateExpiryDate(),
  path = '*',
): IgnoreRulePerPath {
  if (expiryDate.getTime() !== expiryDate.getTime()) {
    debug('Invalid expiry given or none at all, using the default 30 days');
    expiryDate = generateExpiryDate();
  }

  const ignorePerPath: IgnoreRulePerPath = {};
  const ignoreRule = {
    reason,
    expires: expiryDate.toJSON(),
    vulnId,
  };
  ignorePerPath[path] = ignoreRule;
  return ignorePerPath;
}

export function generateExpiryDate(days = 30) {
  return new Date(Date.now() + oneDay * days);
}

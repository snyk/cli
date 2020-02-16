import * as Debug from 'debug';
import { stripVersions } from './strip-versions';
import {
  generateIgnoreRule,
  IgnoreRule,
  generateExpiryDate,
} from '../generate-ignore-rule';

const debug = Debug('snyk');

export async function ignore(data) {
  const config: {
    ignore: unknown;
  } = {
    ignore: undefined,
  };

  const ignores: IgnoreRule[] = data.map(({ vuln, meta }) => {
    const { days, reason } = meta;
    const path = stripVersions(vuln.from.slice(1)).join(' > ');
    const expiryDate = generateExpiryDate(days);
    return generateIgnoreRule(vuln.id, reason, expiryDate, path);
  });

  const ignoresToSave = ignores.reduce((acc, curr) => {
    if (!acc[curr.vulnId]) {
      acc[curr.vulnId] = [];
    }

    const id = curr.vulnId;
    delete curr.vulnId;
    acc[id].push(curr);

    return acc;
  }, {});
  config.ignore = ignoresToSave;
  debug('Updated ignore config:', config);

  return config;
}

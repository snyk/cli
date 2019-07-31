import { SupportedPackageManagers } from '../package-managers';

import * as config from '../config';

export function assembleQueryString(options) {
  const org = options.org || config.org || null;
  const qs: {
    org: string;
    severityThreshold?: boolean;
  } = {
    org,
  };

  if (options.severityThreshold) {
    qs.severityThreshold = options.severityThreshold;
  }

  return Object.keys(qs).length !== 0 ? qs : null;
}

export const SEVERITIES = [
  {
    verboseName: 'low',
    value: 1,
  },
  {
    verboseName: 'medium',
    value: 2,
  },
  {
    verboseName: 'high',
    value: 3,
  },
];
export const WIZARD_SUPPORTED_PMS: SupportedPackageManagers[] = ['npm', 'yarn'];

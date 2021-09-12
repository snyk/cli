import { Analytics } from './types';
import * as analytics from '../../lib/analytics';

export function extractAndApplyPluginAnalytics(
  pluginAnalytics: Analytics[],
  asyncRequestToken?: string,
): void {
  if (asyncRequestToken) {
    analytics.add('asyncRequestToken', asyncRequestToken);
  }
  for (const { name, data } of pluginAnalytics) {
    analytics.add(name, data);
  }
}

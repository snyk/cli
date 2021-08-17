import { Analytics } from './types';
import * as analytics from '../../lib/analytics';

export function extractAndApplyPluginAnalytics(
  pluginAnalytics: Analytics[],
  asyncRequestToken?: string,
) {
  trackAsyncRequestAnalytics(asyncRequestToken);
  for (const { name, data } of pluginAnalytics) {
    analytics.add(name, data);
  }
}

async function trackAsyncRequestAnalytics(asyncRequestToken?: string) {
  if (asyncRequestToken) {
    analytics.add('asyncRequestToken', asyncRequestToken);
  }
}

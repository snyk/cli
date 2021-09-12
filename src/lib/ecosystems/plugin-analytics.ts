import { Analytics } from './types';
import * as analytics from '../../lib/analytics';

export function extractAndApplyPluginAnalytics(pluginAnalytics: Analytics[]) {
  for (const { name, data } of pluginAnalytics) {
    analytics.add(name, data);
  }
}

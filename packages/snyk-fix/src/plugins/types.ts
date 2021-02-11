import { EntityToFix } from '../types';

export type FixHandler = (
  entities: EntityToFix[],
) => Promise<FixHandlerResultByPlugin>;

export interface FixHandlerResultByPlugin {
  [pluginId: string]: {
    succeeded: EntityToFix[];
    failed: EntityToFix[];
    skipped: EntityToFix[];
  };
}
// ecosystem is the plugin
export type Ecosystem = 'python';

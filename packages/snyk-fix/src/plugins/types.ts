import {
  EntityToFix,
  FixOptions,
  WithError,
  WithFixChangesApplied,
  WithUserMessage,
} from '../types';

export type FixHandler = (
  entities: EntityToFix[],
  options: FixOptions,
) => Promise<FixHandlerResultByPlugin>;

export interface PluginFixResponse {
  succeeded: Array<WithFixChangesApplied<EntityToFix>>;
  failed: Array<WithError<EntityToFix>>;
  skipped: Array<WithUserMessage<EntityToFix>>;
}
export interface FixHandlerResultByPlugin {
  [pluginId: string]: PluginFixResponse;
}

export interface FixedCache {
  [filePath: string]: {
    fixedIn: string;
    issueIds: string[];
  };
}

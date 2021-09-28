import {
  EntityToFix,
  FixOptions,
  WithError,
  WithAttemptedFixChanges,
  WithUserMessage,
} from '../types';

export type FixHandler = (
  entities: EntityToFix[],
  options: FixOptions,
) => Promise<FixHandlerResultByPlugin>;

export type FailedToFix =
  | WithAttemptedFixChanges<EntityToFix>
  | WithError<EntityToFix>;

export function isWithError(r: FailedToFix): r is WithError<EntityToFix> {
  return 'error' in r;
}

export interface PluginFixResponse {
  succeeded: Array<WithAttemptedFixChanges<EntityToFix>>;
  failed: FailedToFix[];
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

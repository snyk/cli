export { Log, Tool, Result } from 'sarif';

interface LocalCodeEngine {
  enabled: boolean;
  url: string;
  allowCloudUpload: boolean;
}

export interface SastSettings {
  sastEnabled: boolean;
  code?: number;
  error?: string;
  userMessage?: string;
  localCodeEngine: LocalCodeEngine;
  supportedLanguages?: string[];
  org?: string;
}

export interface TrackUsageResponse {
  code?: number;
  userMessage?: string;
}

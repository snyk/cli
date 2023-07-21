export { Log, Tool, Result } from 'sarif';
import {
  AnalysisResultSarif,
  FileAnalysis,
  ReportResult,
  ScmAnalysis,
} from '@snyk/code-client';

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

export interface CodeTestResults {
  reportResults?: ReportResult['uploadResult'];
  analysisResults: AnalysisResultSarif;
}

export type CodeAnalysisResults =
  | (FileAnalysis & { analysisResults: AnalysisResultSarif })
  | ScmAnalysis;

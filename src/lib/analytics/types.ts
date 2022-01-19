export type StandardAnalyticsData = {
  version: string;
  os: string;
  nodeVersion: string;
  standalone: boolean;
  integrationName: string;
  integrationVersion: string;
  integrationEnvironment: string;
  integrationEnvironmentVersion: string;
  id: string;
  ci: boolean;
  durationMs: number;
  metrics: any[] | undefined;
};

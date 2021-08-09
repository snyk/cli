export type Environment = {
  npmVersion?: string | undefined;
};

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
  environment: Environment;
  durationMs: number;
  metrics: any[] | undefined;
};

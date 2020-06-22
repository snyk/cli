import { BasicResultData, SEVERITY } from './legacy';

export interface AnnotatedCloudConfigIssue {
  id: string;
  title: string;
  description: string;
  severity: SEVERITY;
  isIgnored: boolean;
  cloudConfigPath: string[];
  type: string;
  subType: string;
}

export interface CloudConfigTestResult extends BasicResultData {
  targetFile: string;
  projectName: string;
  displayTargetFile: string; // used for display only
  foundProjectCount: number;
  result: {
    cloudConfigResults: AnnotatedCloudConfigIssue[];
    projectType: string;
  };
}

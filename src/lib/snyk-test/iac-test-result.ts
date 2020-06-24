import { BasicResultData, SEVERITY } from './legacy';

export interface AnnotatedIacIssue {
  id: string;
  title: string;
  description: string;
  severity: SEVERITY;
  isIgnored: boolean;
  iacPath: string[];
  type: string;
  subType: string;
}

export interface IacTestResult extends BasicResultData {
  targetFile: string;
  projectName: string;
  displayTargetFile: string; // used for display only
  foundProjectCount: number;
  result: {
    cloudConfigResults: AnnotatedIacIssue[];
    projectType: string;
  };
}

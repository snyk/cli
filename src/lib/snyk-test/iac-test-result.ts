import { BasicResultData, TestDepGraphMeta, SEVERITY } from './legacy';

export interface AnnotatedIacIssue {
  id: string;
  title: string;
  description: string;
  severity: SEVERITY;
  isIgnored: boolean;
  cloudConfigPath: string[];
  type: string;
  subType: string;
  path: string[];
  // Legacy fields from Registry, unused.
  name?: string;
  from?: string[];
  lineNumber?: number;
}

type FILTERED_OUT_FIELDS = 'cloudConfigPath' | 'name' | 'from';

export interface IacTestResponse extends BasicResultData {
  targetFile: string;
  projectName: string;
  displayTargetFile: string; // used for display only
  foundProjectCount: number;
  meta: TestDepGraphMeta;
  result: {
    cloudConfigResults: AnnotatedIacIssue[];
    projectType: string;
  };
}

const IAC_ISSUES_KEY = 'infrastructureAsCodeIssues';

export function mapIacTestResult(
  iacTest: IacTestResponse,
): MappedIacTestResponse | IacTestError {
  if (iacTest instanceof Error) {
    return {
      ok: false,
      error: iacTest.message,
      path: (iacTest as any).path,
    };
  }

  const {
    result: { projectType },
    ...filteredIacTest
  } = iacTest;
  return {
    ...filteredIacTest,
    projectType,
    [IAC_ISSUES_KEY]:
      iacTest?.result?.cloudConfigResults.map(mapIacIssue) || [],
  };
}

/**
 * The following types represent manipulations to the data structure returned from Registry's `test-iac`.
 * These manipulations are being done prior to outputing as JSON, for renaming fields only.
 * The types above, IacTestResult & AnnotatedIacIssue, represent how the response from Registry actually is.
 * These were introduced in order to prevent cascading complex changes caused by changing Registry's `test-iac` response.
 */
export interface IacTestError {
  ok: boolean;
  error: string;
  path: string;
}

export interface MappedIacTestResponse extends Omit<IacTestResponse, 'result'> {
  [IAC_ISSUES_KEY]: MappedAnnotatedIacIssue[];
  projectType: string;
}

export interface MappedAnnotatedIacIssue
  extends Omit<AnnotatedIacIssue, FILTERED_OUT_FIELDS> {
  path: string[];
}

export function mapIacIssue(
  iacIssue: AnnotatedIacIssue,
): MappedAnnotatedIacIssue {
  // filters out & renames properties we're getting from registry and don't need for the JSON output.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cloudConfigPath: path, name, from, ...mappedIacIssue } = iacIssue;
  return { ...mappedIacIssue, path };
}

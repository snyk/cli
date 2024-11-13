import pick = require('lodash.pick');
import { CustomError } from '../errors';
import { BasicResultData, SEVERITY, TestDepGraphMeta } from './legacy';
import * as debugLib from 'debug';

const debug = debugLib('snyk-iac');

export interface AnnotatedIacIssue {
  id: string;
  publicId: string;
  title: string;
  description?: string;
  severity: SEVERITY | 'none';
  isIgnored: boolean;
  cloudConfigPath: string[];
  type?: string;
  subType: string;
  policyEngineType?: string;
  references: string[];
  path?: string[];
  documentation?: string;
  isGeneratedByCustomRule?: boolean;
  issue: string;
  impact: string;
  resolve: string;
  remediation?: Partial<
    Record<'terraform' | 'cloudformation' | 'arm' | 'kubernetes', string>
  >;
  msg: string;
  compliance?: string[][];

  // Legacy fields from Registry, unused.
  name?: string;
  from?: string[];
  lineNumber?: number;
  iacDescription: {
    issue: string;
    impact: string;
    resolve: string;
  };
}

type FILTERED_OUT_FIELDS = 'cloudConfigPath' | 'name' | 'from';

export interface IacTestResponse extends BasicResultData {
  path: string;
  code?: number;
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
    return mapIacTestError(iacTest);
  }

  if (!iacTest.result) {
    // This is an unexpected scenario, we should always have a result object,
    // but if we don't, we should handle it gracefully.
    debug(`invalid scan result: ${iacTest}`);
    const errorMessage = iacTest.path
      ? `Invalid result for ${iacTest.path}`
      : 'Invalid result';
    return mapIacTestError(
      new CustomError(
        `${errorMessage}. Please run the command again with the \`-d\` flag and contact support@snyk.io with the contents of the output`,
      ),
    );
  }

  const infrastructureAsCodeIssues =
    iacTest?.result?.cloudConfigResults.map(mapIacIssue) || [];
  const {
    result: { projectType },
    ...filteredIacTest
  } = iacTest;
  return {
    ...filteredIacTest,
    projectType,
    ok: infrastructureAsCodeIssues.length === 0,
    [IAC_ISSUES_KEY]: infrastructureAsCodeIssues,
  };
}

export function mapIacTestError(error: Error) {
  return {
    ok: false,
    code: error instanceof CustomError ? error.code : undefined,
    error: error.message,
    path: (error as any).path,
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
  return {
    ...pick(
      iacIssue,
      'id',
      'title',
      'severity',
      'isIgnored',
      'type',
      'subType',
      'policyEngineType',
      'documentation',
      'isGeneratedByCustomRule',
      'issue',
      'impact',
      'resolve',
      'remediation',
      'lineNumber',
      'iacDescription',
      'publicId',
      'msg',
      'description',
      'references',
    ),
    path: iacIssue.cloudConfigPath,
    compliance: [],
  };
}

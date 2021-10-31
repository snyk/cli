import { FormattedResult, PolicyMetadata } from './types';
import { Policy } from '../../../../lib/policy/find-and-load-policy';

export function filterIgnoredIssues(
  policy: Policy | undefined,
  results: FormattedResult[],
) {
  if (!policy) {
    return { filteredIssues: results, ignoreCount: 0 };
  }
  const vulns = results.map((res) =>
    policy.filter(toIaCVulnAdapter(res), undefined, 'exact'),
  );
  const ignoreCount: number = vulns.reduce(
    (totalIgnored, vuln) => totalIgnored + vuln.filtered.ignore.length,
    0,
  );
  const filteredIssues = vulns.map((vuln) => toFormattedResult(vuln));
  return { filteredIssues, ignoreCount };
}

type IacVulnAdapter = {
  vulnerabilities: {
    id: string;
    from: string[];
  }[];
  originalResult: FormattedResult;
  filtered?: { ignore: any[] };
};

// This is a total cop-out. The type I really want is AnnotatedIacIssue from
// src/lib/snyk-test/iac-test-result.ts, but that appears to only be used in the
// legacy flow and I gave up on adapting it to work in both flows. By the time
// this code is called, cloudConfigPath is present on the result object.
type AnnotatedResult = PolicyMetadata & {
  cloudConfigPath: string[];
};

function toIaCVulnAdapter(result: FormattedResult): IacVulnAdapter {
  return {
    vulnerabilities: result.result.cloudConfigResults.map(
      (cloudConfigResult) => {
        const annotatedResult = cloudConfigResult as AnnotatedResult;

        // Copy the cloudConfigPath array to avoid modifying the original with
        // splice.
        // Insert the targetFile into the path so that it is taken into account
        // when determining whether an ignore rule should be applied.
        const path = [...annotatedResult.cloudConfigPath];
        path.splice(0, 0, result.targetFile);

        return {
          id: cloudConfigResult.id as string,
          from: path,
        };
      },
    ),
    originalResult: result,
  };
}

function toFormattedResult(adapter: IacVulnAdapter): FormattedResult {
  const original = adapter.originalResult;
  const filteredCloudConfigResults = original.result.cloudConfigResults.filter(
    (res) => {
      return adapter.vulnerabilities.some((vuln) => {
        if (vuln.id !== res.id) {
          return false;
        }

        // Unfortunately we are forced to duplicate the logic in
        // toIaCVulnAdapter so that we're comparing path components properly,
        // including target file context. As that logic changes, so must this.
        const annotatedResult = res as AnnotatedResult;
        const significantPath = [...annotatedResult.cloudConfigPath];
        significantPath.splice(0, 0, original.targetFile);

        if (vuln.from.length !== significantPath.length) {
          return false;
        }
        for (let i = 0; i < vuln.from.length; i++) {
          if (vuln.from[i] !== significantPath[i]) {
            return false;
          }
        }
        return true;
      });
    },
  );
  original.result.cloudConfigResults = filteredCloudConfigResults;
  return original;
}

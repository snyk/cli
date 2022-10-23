import { SEVERITY } from '../../../../snyk-test/legacy';
import { ResourceKind, TestOutput } from '../scan/results';

export function getIacType(testOutput: TestOutput): IacType {
  const resourcesCountByPackageManager = getResourcesCountByPackageManager(
    testOutput,
  );

  const filesCountByPackageManager = getFilesCountByPackageManager(testOutput);

  const vulnAnalyticsByPackageManager = getVulnerabilityAnalyticsByPackageManager(
    testOutput,
  );

  return Object.keys(resourcesCountByPackageManager).reduce(
    (acc, packageManager) => {
      acc[packageManager] = {
        count: filesCountByPackageManager[packageManager],
        'resource-count': resourcesCountByPackageManager[packageManager],
        ...vulnAnalyticsByPackageManager[packageManager],
      };
      return acc;
    },
    {},
  );
}

export type PackageManager = ResourceKind;

export type IacType = {
  [packageManager in PackageManager]?: {
    count: number;
    'resource-count': number;
  } & {
    [severity in SEVERITY]?: number;
  };
};

function getResourcesCountByPackageManager(
  testOutput: TestOutput,
): ResourcesCountByPackageManager {
  if (!testOutput.results?.resources?.length) {
    return {};
  }

  return testOutput.results.resources.reduce((acc, resource) => {
    const packageManager = resource.kind;

    if (!acc[packageManager]) {
      acc[packageManager] = 0;
    }

    acc[packageManager]++;

    return acc;
  }, {});
}

export type ResourcesCountByPackageManager = {
  [packageManager in PackageManager]?: number;
};

function getFilesCountByPackageManager(
  testOutput: TestOutput,
): FilesCountByPackageManager {
  if (!testOutput.results?.resources?.length) {
    return {};
  }

  return Object.entries(
    testOutput.results.resources.reduce((acc, resource) => {
      const packageManager = resource.kind;

      if (!acc[packageManager]) {
        acc[packageManager] = new Set();
      }

      acc[packageManager].add(resource.file);

      return acc;
    }, {} as { [packageManager in PackageManager]: Set<string> }),
  ).reduce((acc, [packageManager, filesSet]) => {
    acc[packageManager] = filesSet.size;

    return acc;
  }, {});
}

export type FilesCountByPackageManager = {
  [packageManager in PackageManager]?: number;
};

function getVulnerabilityAnalyticsByPackageManager(
  testOutput: TestOutput,
): VulnerabilityAnalyticsByPackageManager {
  if (!testOutput.results?.vulnerabilities?.length) {
    return {};
  }

  return testOutput.results.vulnerabilities.reduce((acc, vuln) => {
    const packageManager = vuln.resource.kind;

    if (!acc[packageManager]) {
      acc[packageManager] = {};
    }

    if (!acc[packageManager][vuln.severity]) {
      acc[packageManager][vuln.severity] = 0;
    }

    acc[packageManager][vuln.severity]++;

    return acc;
  }, {});
}

export type VulnerabilityAnalyticsByPackageManager = {
  [packageManager in PackageManager]?: VulnerabilityAnalytics;
};

export type VulnerabilityAnalytics = {
  [severity in SEVERITY]?: number;
};

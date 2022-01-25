import { TestResult } from '../../../lib/snyk-test/legacy';

export function getPathWithOptionalProjectName(
  currPath: string,
  testResult: Pick<TestResult, 'projectName'>,
): string {
  let projectName = testResult.projectName;
  if (projectName) {
    const index = projectName.indexOf('/');
    if (index > -1) {
      projectName = projectName.substr(index + 1);
    } else {
      projectName = undefined;
    }
  }
  const pathWithOptionalProjectName = projectName
    ? `${currPath}/${projectName}`
    : currPath;

  return pathWithOptionalProjectName;
}

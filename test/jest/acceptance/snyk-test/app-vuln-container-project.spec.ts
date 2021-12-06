import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import * as fs from 'fs';
import * as path from 'path';
import * as legacy from '../../../../src/lib/snyk-test/legacy';
import {
  Options,
  SupportedProjectTypes,
  TestOptions,
} from '../../../../src/lib/types';

describe('container test projects behavior with --app-vulns, --file and --exclude-base-image-vulns flags', () => {
  const fixturePath = path.normalize('test/fixtures/container-projects');

  function readFixture(filename: string) {
    const filePath = path.join(fixturePath, filename);
    console.log(filePath);
    return fs.readFileSync(filePath, 'utf8');
  }

  function readJsonFixture(filename: string) {
    const contents = readFixture(filename);
    return JSON.parse(contents);
  }

  interface fixture {
    res: legacy.TestDepGraphResponse;
    depGraph: DepGraphData;
    packageManager: SupportedProjectTypes;
    options: Options & TestOptions;
  }

  const mockApkFixture = readJsonFixture(
    'app-vuln-apk-fixture.json',
  ) as fixture;
  const mockNpmFixture = readJsonFixture(
    'app-vuln-npm-fixture.json',
  ) as fixture;

  it('should return no vulnerability for apk fixture', async () => {
    const result = legacy.convertTestDepGraphResultToLegacy(
      mockApkFixture.res,
      createFromJSON(mockApkFixture.depGraph),
      mockApkFixture.packageManager,
      mockApkFixture.options,
    );
    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.ok).toEqual(true);
  });

  it('should return vulnerabilities for npm fixture', async () => {
    const result = legacy.convertTestDepGraphResultToLegacy(
      mockNpmFixture.res,
      createFromJSON(mockNpmFixture.depGraph),
      mockNpmFixture.packageManager,
      mockNpmFixture.options,
    );
    expect(result.vulnerabilities).toHaveLength(10);
    expect(result.ok).toEqual(false);
  });
});

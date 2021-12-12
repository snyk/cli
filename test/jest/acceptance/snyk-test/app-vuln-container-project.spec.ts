import { createFromJSON, DepGraphData } from '@snyk/dep-graph';
import * as fs from 'fs';
import * as path from 'path';
import * as legacy from '../../../../src/lib/snyk-test/legacy';
import {
  Options,
  SupportedProjectTypes,
  TestOptions,
} from '../../../../src/lib/types';
import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';

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

describe('container test projects behavior with --app-vulns, --json flags', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_INTEGRATION_NAME: 'JENKINS',
      SNYK_INTEGRATION_VERSION: '1.2.3',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('returns a json with the --experimental flags', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test snykgoof/os-app:node-snykin --app-vulns --json --experimental`,
      {
        env,
      },
    );

    const jsonOutput = JSON.parse(stdout);
    expect(Array.isArray(jsonOutput)).toBeTruthy();
    expect(jsonOutput).toHaveLength(3);
    expect(code).toEqual(0);
  });

  it('returns an error without the --experimental flags', async () => {
    const { code, stdout } = await runSnykCLI(
      `container test snykgoof/os-app:node-snykin --app-vulns --json`,
      {
        env,
      },
    );

    expect(stdout).toContain(
      'Application vulnerabilities is currently not supported with JSON output',
    );
    expect(code).toEqual(2);
  });
});

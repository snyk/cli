import { promises as fs } from 'fs';
import { getFixturePath } from '../../../util/getFixturePath';
import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../../util/createProject';
import { runSnykCLI } from '../../../util/runSnykCLI';
import { fakeServer } from '../../../../acceptance/fake-server';
import { getServerPort } from '../../../util/getServerPort';

jest.setTimeout(1000 * 60);

const toonEnvelope = /^results\[\d+\]:/;

// Structure from GAF internal/presenters/testdata/ufm/toon/{sca,empty_sca}.toon
// — contract fields only, not byte goldens from real scans.
function expectUfmToonContract(stdout: string, variant: 'sca' | 'empty_sca') {
  expect(stdout).toMatch(toonEnvelope);
  expect(stdout).toContain('executionState: finished');
  expect(stdout).toContain('errors: null');
  expect(stdout).toContain('effectiveSummary');
  expect(stdout).toContain('rawSummary');

  if (variant === 'sca') {
    expect(stdout).toContain('passFail: fail');
    expect(stdout).toContain('finding_type: sca');
    expect(stdout).toContain('type: findings');
    expect(stdout).toContain('attributes:');
    expect(stdout).toContain('locations');
    expect(stdout).toContain('problems');
  } else {
    expect(stdout).toContain('passFail: pass');
    expect(stdout).toContain('findings: []');
    expect(stdout).toContain('count: 0');
  }
}

describe('snyk test --toon', () => {
  let server;
  let env: Record<string, string>;

  function mockResults(findings: unknown[]) {
    const testPath =
      '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/tests/aaaaaaaa-bbbb-cccc-dddd-000000000002';
    server.setEndpointResponse(testPath, {
      data: {
        id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002',
        type: 'tests',
        attributes: {
          state: { execution: 'finished' },
          outcome: { result: findings.length ? 'fail' : 'pass' },
          effective_summary: { count: findings.length },
          raw_summary: { count: findings.length },
          config: { scan_config: { sca: {} } },
        },
      },
    });
    server.setEndpointResponse(`${testPath}/findings`, { data: findings });
    for (const endpoint of [testPath, `${testPath}/findings`]) {
      server.setEndpointHeaders(endpoint, {
        'Content-Type': 'application/vnd.api+json',
      });
    }
  }

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => done());
  });

  beforeEach(() => {
    // Select the native OS route; legacy ignores TOON flags.
    server.setFeatureFlag('useExperimentalRiskScore', true);
    server.setFeatureFlag('useExperimentalRiskScoreInCLI', true);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  test.each(['--toon', '--toon-file-output=result.toon'])(
    '`snyk test %s` emits UFM TOON',
    async (flag) => {
      const project = await createProjectFromFixture(
        'npm/with-vulnerable-lodash-dep',
      );
      const findings = JSON.parse(
        await fs.readFile(
          getFixturePath('sbom/uv-findings-response.json'),
          'utf8',
        ),
      ).data;
      mockResults(findings);

      const { code, stdout, stderr } = await runSnykCLI(
        `test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}`,
        {
          cwd: project.path(),
          env,
        },
      );

      expect(stderr).toBe('');
      expect(code).toEqual(1);
      if (flag === '--toon') {
        expectUfmToonContract(stdout, 'sca');
      } else {
        expectUfmToonContract(await project.read('result.toon'), 'sca');
        expect(stdout).not.toMatch(toonEnvelope);
        expect(stdout).toContain('Tested');
      }
    },
  );

  test.each(['--toon', '--toon-file-output=result.toon'])(
    '`snyk test %s` on a clean project reports empty findings',
    async (flag) => {
      const project = await createProjectFromWorkspace('ruby-app-no-vulns');
      mockResults([]);

      const { code, stdout, stderr } = await runSnykCLI(
        `test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}`,
        {
          cwd: project.path(),
          env,
        },
      );

      expect(stderr).toBe('');
      expect(code).toEqual(0);
      if (flag === '--toon') {
        expectUfmToonContract(stdout, 'empty_sca');
      } else {
        expectUfmToonContract(await project.read('result.toon'), 'empty_sca');
        expect(stdout).not.toMatch(toonEnvelope);
        expect(stdout).toContain('Tested');
      }
    },
  );
});

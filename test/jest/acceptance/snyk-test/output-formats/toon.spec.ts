import { promises as fs } from 'fs';
import { getFixturePath } from '../../../util/getFixturePath';
import { createProject } from '../../../util/createProject';
import { runSnykCLI } from '../../../util/runSnykCLI';
import { fakeServer } from '../../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../../util/getServerPort';

jest.setTimeout(1000 * 60);

const toonSection = /^sca(?:\[\d+\]\{|:)/m;

// Structure from GAF internal/presenters/testdata/ufm/toon/{sca,empty_sca}.toon
// — contract fields only, not byte goldens from real scans.
function expectUfmToonContract(
  stdout: string,
  variant: 'sca' | 'empty_sca',
  full = false,
) {
  expect(stdout).toContain('org: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  if (full) {
    expect(stdout).not.toContain('hint: add --toon=full for all fields');
  } else {
    expect(stdout).toContain('hint: add --toon=full for all fields');
  }

  if (variant === 'sca') {
    if (full) {
      expect(stdout).toContain(
        'sca[2]{cvss,fixable,id,pkg,severity,title,upgrade}:',
      );
      expect(stdout).toContain(
        '"5.3",yes,SNYK-PYTHON-JINJA2-1012994,jinja2@2.11.2,medium,Regular Expression Denial of Service (ReDoS),jinja2@2.11.3',
      );
      expect(stdout).toContain(
        '"8.9",yes,SNYK-PYTHON-URLLIB3-14192442,urllib3@1.24.3,high,Improper Handling of Highly Compressed Data (Data Amplification),urllib3@2.6.0',
      );
    } else {
      expect(stdout).toContain('sca[2]{fixable,id,pkg,severity}:');
      expect(stdout).toContain(
        'yes,SNYK-PYTHON-JINJA2-1012994,jinja2@2.11.2,medium',
      );
      expect(stdout).toContain(
        'yes,SNYK-PYTHON-URLLIB3-14192442,urllib3@1.24.3,high',
      );
    }
  } else {
    expect(stdout).toMatch(/^sca: \[\]$/m);
  }
}

// `--toon=<mode>` also selects TOON for stdout, so combined with a file
// output both destinations render; without it stdout stays human-readable.
function expectStdoutForFileOutput(
  stdout: string,
  variant: 'sca' | 'empty_sca',
  full: boolean,
) {
  if (full) {
    expectUfmToonContract(stdout, variant, full);
  } else {
    expect(stdout).not.toMatch(toonSection);
    expect(stdout).toContain('Tested');
  }
}

describe('snyk test --toon', () => {
  let server;
  let env: Record<string, string>;

  function mockResults(
    findings: unknown[],
    targetFiles = ['package-lock.json'],
  ) {
    const testPath =
      '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/tests/aaaaaaaa-bbbb-cccc-dddd-000000000002';
    server.setEndpointResponses(
      testPath,
      targetFiles.map((targetFile) => ({
        data: {
          id: 'aaaaaaaa-bbbb-cccc-dddd-000000000002',
          type: 'tests',
          attributes: {
            state: { execution: 'finished' },
            outcome: { result: findings.length ? 'fail' : 'pass' },
            effective_summary: { count: findings.length },
            raw_summary: { count: findings.length },
            config: { scan_config: { sca: {} } },
            subject: {
              type: 'dep_graph',
              locator: { type: 'local_path', paths: [targetFile] },
            },
          },
        },
      })),
    );
    server.setEndpointResponse(`${testPath}/findings`, { data: findings });
    for (const endpoint of [testPath, `${testPath}/findings`]) {
      server.setEndpointHeaders(endpoint, {
        'Content-Type': 'application/vnd.api+json',
      });
    }
  }

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
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

  test('legacy route ignores --toon flags', async () => {
    server.setFeatureFlag('useExperimentalRiskScore', false);
    server.setFeatureFlag('useExperimentalRiskScoreInCLI', false);
    const project = await createProject('npm/with-vulnerable-lodash-dep');
    const findings = JSON.parse(
      await fs.readFile(
        getFixturePath('sbom/uv-findings-response.json'),
        'utf8',
      ),
    ).data;
    mockResults(findings);

    const { stdout, stderr } = await runSnykCLI(
      'test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --toon --toon-file-output=result.toon',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('Tested');
    expect(stdout).not.toMatch(toonSection);
    await expect(project.read('result.toon')).rejects.toThrow();
  });

  test.each([
    ['--toon', ''],
    ['--toon', '--toon=full'],
    ['--toon-file-output=result.toon', ''],
    ['--toon-file-output=result.toon', '--toon=full'],
  ])('`snyk test %s %s` emits UFM TOON', async (flag, fullFlag) => {
    const project = await createProject('npm/with-vulnerable-lodash-dep');
    const findings = JSON.parse(
      await fs.readFile(
        getFixturePath('sbom/uv-findings-response.json'),
        'utf8',
      ),
    ).data;
    mockResults(findings);

    const { code, stdout, stderr } = await runSnykCLI(
      `test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}${fullFlag ? ` ${fullFlag}` : ''}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(stderr).toBe('');
    expect(code).toEqual(1);
    const full = fullFlag === '--toon=full';
    if (flag === '--toon') {
      expectUfmToonContract(stdout, 'sca', full);
    } else {
      expectUfmToonContract(await project.read('result.toon'), 'sca', full);
      expectStdoutForFileOutput(stdout, 'sca', full);
    }
  });

  test('`snyk test --toon=false` renders human-readable output', async () => {
    const project = await createProject('npm/with-vulnerable-lodash-dep');
    const findings = JSON.parse(
      await fs.readFile(
        getFixturePath('sbom/uv-findings-response.json'),
        'utf8',
      ),
    ).data;
    mockResults(findings);

    const { code, stdout, stderr } = await runSnykCLI(
      'test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --toon=false',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(stderr).toBe('');
    expect(code).toEqual(1);
    expect(stdout).toContain('Tested');
    expect(stdout).not.toMatch(toonSection);
  });

  test.each([
    ['--toon', ''],
    ['--toon', '--toon=full'],
    ['--toon-file-output=result.toon', ''],
    ['--toon-file-output=result.toon', '--toon=full'],
  ])(
    '`snyk test %s %s` preserves empty API findings',
    async (flag, fullFlag) => {
      const project = await createProject('npm/with-vulnerable-lodash-dep');
      mockResults([]);

      const { code, stdout, stderr } = await runSnykCLI(
        `test --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}${fullFlag ? ` ${fullFlag}` : ''}`,
        {
          cwd: project.path(),
          env,
        },
      );

      expect(stderr).toBe('');
      expect(code).toEqual(0);
      const full = fullFlag === '--toon=full';
      if (flag === '--toon') {
        expectUfmToonContract(stdout, 'empty_sca', full);
      } else {
        expectUfmToonContract(
          await project.read('result.toon'),
          'empty_sca',
          full,
        );
        expectStdoutForFileOutput(stdout, 'empty_sca', full);
      }
    },
  );

  test.each([
    ['--toon', ''],
    ['--toon', '--toon=full'],
    ['--toon-file-output=result.toon', ''],
    ['--toon-file-output=result.toon', '--toon=full'],
  ])(
    '`snyk test --all-projects %s %s` includes both projects',
    async (flag, fullFlag) => {
      const project = await createProject('npm/with-vulnerable-lodash-dep');
      try {
        await fs.mkdir(project.path('subproject'));
        for (const file of ['package.json', 'package-lock.json']) {
          await fs.copyFile(
            project.path(file),
            project.path(`subproject/${file}`),
          );
        }
        const targetFiles = [
          'package-lock.json',
          'subproject/package-lock.json',
        ];
        mockResults([], targetFiles);

        const { code, stdout, stderr } = await runSnykCLI(
          `test --all-projects --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}${fullFlag ? ` ${fullFlag}` : ''}`,
          { cwd: project.path(), env },
        );

        expect(stderr).toBe('');
        expect(code).toBe(0);
        const full = fullFlag === '--toon=full';
        const output =
          flag === '--toon' ? stdout : await project.read('result.toon');
        expectUfmToonContract(output, 'empty_sca', full);
        const submittedPaths = server
          .getRequests()
          .filter(
            (request) =>
              request.method === 'POST' && request.path.endsWith('/tests'),
          )
          .flatMap(
            (request) => request.body.data.attributes.subject.locator.paths,
          )
          .map((file: string) => file.replace(/\\/g, '/'));
        expect(submittedPaths.sort()).toEqual(targetFiles.sort());
        if (flag !== '--toon') {
          expectStdoutForFileOutput(stdout, 'empty_sca', full);
        }
      } finally {
        await project.remove();
      }
    },
  );
});

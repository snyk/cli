import { promises as fs } from 'fs';
import { getFixturePath } from '../../../util/getFixturePath';
import { createProject } from '../../../util/createProject';
import { runSnykCLI } from '../../../util/runSnykCLI';
import { fakeServer } from '../../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../../util/getServerPort';

jest.setTimeout(1000 * 60);

const htmlDoctype = /^<!doctype html>/;

// Structure from GAF internal/presenters/templates/ufm.html.tmpl and its
// golden fixture internal/presenters/testdata/ufm/cli.html — contract
// markers only, not a byte golden from a real scan.
function expectUfmHtmlContract(html: string, variant: 'sca' | 'empty_sca') {
  expect(html).toMatch(htmlDoctype);
  expect(html).toContain('<title>Snyk Test Report</title>');
  expect(html).toContain(
    '<span class="meta-label">Test type</span><span class="meta-value">Software Composition Analysis</span>',
  );

  if (variant === 'sca') {
    expect(html).toContain('Open issues: 2');
    expect(html).toContain('Open Security Issues (2)');
    expect(html).toContain('class="issue-card severity--medium"');
    expect(html).toContain('class="issue-card severity--high"');
    expect(html).toContain(
      '<h3>Regular Expression Denial of Service (ReDoS)</h3>',
    );
    expect(html).toContain(
      '<h3>Improper Handling of Highly Compressed Data (Data Amplification)</h3>',
    );
    expect(html).toContain('<li class="card-meta-item">CWE-400</li>');
    expect(html).toContain('<li class="card-meta-item">CWE-409</li>');
    expect(html).toContain(
      '<span class="detail-label">Vulnerable module:</span> jinja2@2.11.2',
    );
    expect(html).toContain(
      '<span class="detail-label">Vulnerable module:</span> urllib3@1.24.3',
    );
    expect(html).toContain('More about this vulnerability');
  } else {
    expect(html).toContain('content="0 open issues.">');
    expect(html).toContain('Open issues: 0');
    expect(html).not.toContain('Open Security Issues');
    expect(html).not.toContain('<div class="issue-card');
  }
}

describe('snyk test --html', () => {
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
      INTERNAL_PREVIEW_FEATURES_ENABLED: 'true',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  beforeEach(() => {
    // Select the native OS route; legacy ignores HTML flags.
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

  test.each(['--html', '--html-file-output=result.html'])(
    '`snyk test %s` emits UFM HTML',
    async (flag) => {
      const project = await createProject('npm/with-vulnerable-lodash-dep');
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
      if (flag === '--html') {
        expectUfmHtmlContract(stdout, 'sca');
      } else {
        expectUfmHtmlContract(await project.read('result.html'), 'sca');
        expect(stdout).not.toMatch(htmlDoctype);
        expect(stdout).toContain('Tested');
      }
    },
  );

  test.each(['--html', '--html-file-output=result.html'])(
    '`snyk test %s` preserves empty API findings',
    async (flag) => {
      const project = await createProject('npm/with-vulnerable-lodash-dep');
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
      if (flag === '--html') {
        expectUfmHtmlContract(stdout, 'empty_sca');
      } else {
        expectUfmHtmlContract(await project.read('result.html'), 'empty_sca');
        expect(stdout).not.toMatch(htmlDoctype);
        expect(stdout).toContain('Tested');
      }
    },
  );

  test.each(['--html', '--html-file-output=result.html'])(
    '`snyk test --all-projects %s` includes both projects',
    async (flag) => {
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
          `test --all-projects --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ${flag}`,
          { cwd: project.path(), env },
        );

        expect(stderr).toBe('');
        expect(code).toBe(0);
        const output =
          flag === '--html' ? stdout : await project.read('result.html');
        expect(output).toMatch(htmlDoctype);
        expect(output.match(/<div class="container">/g)).toHaveLength(2);
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
        if (flag !== '--html') {
          expect(stdout).not.toMatch(htmlDoctype);
          expect(stdout).toContain('Tested');
        }
      } finally {
        await project.remove();
      }
    },
  );
});

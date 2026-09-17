import { promises as fs } from 'fs';
import { join } from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { makeTmpDirectory } from '../../../utils';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(60_000);

describe('snyk secrets test HTML output', () => {
  const orgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const testId = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';
  const testPath = `/rest/orgs/${orgId}/tests/${testId}`;
  const server = fakeServer('/v1', '123456789');
  let env: Record<string, string>;
  let directory: string;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    await server.listenPromise(port);
    env = {
      ...process.env,
      SNYK_API: `http://localhost:${port}/v1`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      INTERNAL_SNYK_FEATURE_FLAG_IS_SECRETS_ENABLED: 'true',
    };
  });

  beforeEach(async () => {
    directory = await makeTmpDirectory();
    await fs.writeFile(join(directory, 'config.txt'), 'synthetic scan input');
  });

  afterEach(async () => {
    server.restore();
    await fs.rm(directory, { recursive: true, force: true });
  });

  afterAll(() => server.closePromise());

  describe.each([0, 1])('%i findings', (count) => {
    test.each(['--html', '--html-file-output=result.html'])(
      '%s preserves the result and exit code',
      async (flag) => {
        server.setEndpointResponse(testPath, {
          data: {
            id: testId,
            type: 'tests',
            attributes: {
              state: { execution: 'finished' },
              outcome: { result: count ? 'fail' : 'pass' },
              effective_summary: { count },
              raw_summary: { count },
              config: { scan_config: { secrets: {} } },
            },
          },
        });
        server.setEndpointResponse(`${testPath}/findings`, {
          data: count
            ? [
                {
                  id: '00000000-0000-4000-8000-000000000003',
                  type: 'findings',
                  attributes: {
                    finding_type: 'secret',
                    title: 'Synthetic secret',
                    key: 'synthetic-secret',
                    description: 'A synthetic secret for acceptance testing.',
                    cause_of_failure: true,
                    rating: { severity: 'high' },
                    locations: [
                      {
                        type: 'source',
                        file_path: 'config.txt',
                        from_line: 1,
                        to_line: 1,
                      },
                    ],
                    problems: [
                      {
                        id: 'synthetic-secret',
                        source: 'secret',
                        name: 'Synthetic secret',
                      },
                    ],
                    evidence: [],
                    policy_modifications: [],
                    risk: {},
                  },
                },
              ]
            : [],
        });
        for (const endpoint of [testPath, `${testPath}/findings`]) {
          server.setEndpointHeaders(endpoint, {
            'Content-Type': 'application/vnd.api+json',
          });
        }

        const { code, stdout, stderr } = await runSnykCLI(
          `secrets test --org=${orgId} ${flag}`,
          {
            cwd: directory,
            env,
          },
        );
        expect(stderr).toBe('');
        expect(code).toBe(count ? 1 : 0);
        const output =
          flag === '--html'
            ? stdout
            : await fs.readFile(join(directory, 'result.html'), 'utf8');
        expect(output).toMatch(/^<!doctype html>/);
        expect(output).toContain('<title>Snyk Test Report</title>');
        expect(output).toContain(
          '<span class="meta-label">Test type</span><span class="meta-value">Secret Detection</span>',
        );
        if (count) {
          expect(output).toContain('Open issues: 1');
          expect(output).toContain('Open Secrets Issues (1)');
          expect(output).toContain('class="issue-card severity--high"');
          expect(output).toContain('<h3>Synthetic secret</h3>');
          expect(output).toContain(
            '<li class="card-meta-item">00000000-0000-4000-8000-000000000003</li>',
          );
          expect(output).toContain('<li class="card-meta-item">Secrets</li>');
          expect(output).toContain(
            'Found in: <strong>config.txt, line 1</strong>',
          );
        } else {
          expect(output).toContain('content="0 open issues.">');
          expect(output).toContain('Open issues: 0');
          expect(output).not.toContain('Open Secrets Issues');
          expect(output).not.toContain('issue-card');
        }
        if (flag !== '--html') {
          expect(stdout).not.toMatch(/^<!doctype html>/);
          expect(stdout).toContain('Secret Detection');
        }
        expect(server.getRequests()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              method: 'POST',
              path: `/rest/orgs/${orgId}/tests`,
            }),
            expect.objectContaining({
              method: 'GET',
              path: `${testPath}/findings`,
            }),
          ]),
        );
      },
    );
  });
});

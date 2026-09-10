import { promises as fs } from 'fs';
import { join } from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { makeTmpDirectory } from '../../../utils';
import { getServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(60_000);

describe('snyk secrets test TOON output', () => {
  const orgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const testId = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';
  const testPath = `/rest/orgs/${orgId}/tests/${testId}`;
  const server = fakeServer('/v1', '123456789');
  let env: Record<string, string>;
  let directory: string;

  beforeAll(async () => {
    const port = getServerPort(process);
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
    test.each(['--toon', '--toon-file-output=result.toon'])(
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
          flag === '--toon'
            ? stdout
            : await fs.readFile(join(directory, 'result.toon'), 'utf8');
        expect(output).toMatch(/^results\[1\]:/);
        expect(output).toContain('executionState: finished');
        expect(output).toContain('errors: null');
        expect(output).toContain(`passFail: ${count ? 'fail' : 'pass'}`);
        expect(output).toContain(`count: ${count}`);
        expect(output).toContain('effectiveSummary:');
        expect(output).toContain('rawSummary:');
        if (count) {
          expect(output).toContain('finding_type: secret');
          expect(output).toContain('config.txt');
          expect(output).toContain('Synthetic secret');
        } else {
          expect(output).toContain('findings: []');
        }
        if (flag !== '--toon') {
          expect(stdout).not.toMatch(/results\[\d+\]:/);
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

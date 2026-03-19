import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { resolve, join } from 'path';
import { readFileSync, rmSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { getAvailableServerPort } from '../../util/getServerPort';
import { createFakeTargetServer } from './fake-target-server';
import * as http from 'http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R = unknown> {
      toHaveExitCode(expected: number): CustomMatcherResult;
    }
  }
}

jest.setTimeout(1000 * 60);

expect.extend({
  toHaveExitCode(
    result: { code: number; stdout: string; stderr: string },
    expected: number,
  ) {
    const pass = result.code === expected;
    const divider = '─'.repeat(60);
    const message = () => {
      const lines = [
        '',
        `Expected exit code: ${expected}`,
        `Received exit code: ${result.code}`,
        '',
        divider,
        'STDOUT',
        divider,
        result.stdout || '(empty)',
      ];
      if (result.stderr) {
        lines.push('', divider, 'STDERR', divider, result.stderr);
      }
      return lines.join('\n');
    };
    return { pass, message };
  },
});

// TODO: verify if we want to print values other than JSON to stdout by default
function extractJSON(stdout: string): string {
  const start = stdout.indexOf('{');
  if (start === -1) return stdout;
  return stdout.substring(start);
}

describe('snyk redteam (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let targetServer: http.Server;
  let env: Record<string, string>;
  let redteamTarget: string;
  let targetURL: string;
  let tmpDir: string | undefined;
  const projectRoot = resolve(__dirname, '../../../..');
  const tenantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeAll(async () => {
    const baseApi = '/api/v1';
    const ipAddr = getFirstIPv4Address();
    redteamTarget = resolve(projectRoot, 'test/fixtures/redteam/redteam.yaml');

    // Start the fake API server first so its port is bound
    const port = await getAvailableServerPort(process);
    const serverBase = `http://${ipAddr}:${port}`;
    server = fakeServer(baseApi, '123456789');
    await server.listenPromise(port);

    // Start the target server (separate from the fake API server)
    const targetPort = await getAvailableServerPort(process);
    targetServer = await createFakeTargetServer(
      ipAddr,
      parseInt(targetPort, 10),
    );
    targetURL = `http://${ipAddr}:${targetPort}/chat`;

    env = {
      ...process.env,
      SNYK_API: `${serverBase}${baseApi}`,
      SNYK_HOST: serverBase,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_CFG_ORG: tenantId,
      SNYK_OAUTH_TOKEN: '',
      INTERNAL_OAUTH_TOKEN_STORAGE: '',
      XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'snyk-config-')),
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  afterAll((done) => {
    targetServer.close(() => {
      server.close(() => {
        done();
      });
    });
  });

  test('`redteam` generates a redteam report', async () => {
    expect(server.getRequests().length).toEqual(0);
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    let report: any;
    expect(() => {
      report = JSON.parse(extractJSON(result.stdout));
    }).not.toThrow();

    const scanId = '59622253-75f3-4439-ac1e-ce94834c5804';
    const scanPath = `/api/hidden/tenants/${tenantId}/red_team_scans`;
    const redteamRequests = server
      .getRequests()
      .filter(
        (req) =>
          req.url?.includes('/red_team_scans') ||
          req.url?.includes('/hidden/profiles'),
      )
      .map((req) => ({
        method: req.method,
        path: req.url?.split('?')[0],
      }));

    expect(redteamRequests).toEqual([
      { method: 'GET', path: '/api/hidden/profiles' }, // resolve default profile
      { method: 'POST', path: scanPath }, // create scan
      { method: 'POST', path: `${scanPath}/${scanId}/next` }, // get prompts (returns 1 chat)
      { method: 'GET', path: `${scanPath}/${scanId}/status` }, // progress update
      { method: 'POST', path: `${scanPath}/${scanId}/next` }, // get prompts (returns empty, loop ends)
      { method: 'GET', path: `${scanPath}/${scanId}/status` }, // final progress
      { method: 'GET', path: `${scanPath}/${scanId}/report` }, // fetch report
    ]);

    expect(report).toMatchObject({
      id: expect.any(String),
      results: expect.arrayContaining([
        expect.objectContaining({
          definition: {
            description: expect.any(String),
            id: expect.any(String),
            name: expect.any(String),
          },
          evidence: {
            content: {
              reason: expect.any(String),
            },
            type: expect.any(String),
          },
          id: expect.any(String),
          severity: expect.any(String),
          url: expect.any(String),
        }),
      ]),
    });
  });

  test('`redteam` fails if configuration is invalid', async () => {
    const invalidRedteamTarget = resolve(
      projectRoot,
      'test/fixtures/redteam/redteam_invalid.yaml',
    );
    const result = await runSnykCLI(
      `redteam --config=${invalidRedteamTarget} --experimental --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(2);
    expect(result.stdout).toContain('target URL is required');
  });

  /**
   * TODO(pkey): when running the tests, underlying go framework is NOT converting http errors to Snyk Errors.
   * As a result, locally or in CI, this test doesn't go through the same error handling path.
   * This needs to be addressed either by handling both cases equally in the cli extension or
   * by fixing the framework to be consistent across all environments.
   *
   * Leaving this test disabled so that it can be enabled when underlying issue is fixed.
   */
  test.skip('`redteam` displays a 400 error properly', async () => {
    server.setStatusCode(400);
    server.setEndpointResponse('/api/v1/ai_scans', {
      errors: [
        {
          status: '400',
          detail: 'This is the error message',
          title: 'Bad Request',
        },
      ],
    });
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(2);
    expect(result.stdout).toContain('400');
    expect(result.stdout).toContain('This is the error message');
  });

  test('`redteam get` retrieves scan results', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804 --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    let report: any;
    expect(() => {
      report = JSON.parse(extractJSON(result.stdout));
    }).not.toThrow();

    expect(report).toMatchObject({
      id: expect.any(String),
      results: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          severity: expect.any(String),
          definition: {
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
          },
          evidence: {
            content: {
              reason: expect.any(String),
            },
            type: expect.any(String),
          },
          url: expect.any(String),
        }),
      ]),
    });
  });

  test('`redteam --html` outputs HTML report to stdout', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --html --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('<!doctype html>');
    expect(result.stdout).toContain('system-prompt-exfiltration');
  });

  test('`redteam --html-file-output` writes HTML report to file', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'snyk-redteam-'));
    const htmlFile = join(tmpDir, 'report.html');
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --html-file-output=${htmlFile} --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    expect(() => JSON.parse(extractJSON(result.stdout))).not.toThrow();

    const html = readFileSync(htmlFile, 'utf-8');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('system-prompt-exfiltration');
  });

  test('`redteam get --html` outputs HTML report to stdout', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804 --html --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('<!doctype html>');
    expect(result.stdout).toContain('system-prompt-exfiltration');
  });

  test('`redteam get --html-file-output` writes HTML report to file', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'snyk-redteam-'));
    const htmlFile = join(tmpDir, 'report.html');
    const result = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804 --html-file-output=${htmlFile} --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    expect(() => JSON.parse(extractJSON(result.stdout))).not.toThrow();

    const html = readFileSync(htmlFile, 'utf-8');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('system-prompt-exfiltration');
  });

  test('`redteam` report includes scan summary', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    const report = JSON.parse(extractJSON(result.stdout));
    expect(report.summary).toBeDefined();
    expect(report.summary.vulnerabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engine_tag: expect.any(String),
          slug: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          severity: expect.any(String),
          status: expect.any(String),
          vulnerable: expect.any(Boolean),
        }),
      ]),
    );

    const vulnerable = report.summary.vulnerabilities.filter(
      (v: any) => v.vulnerable,
    );
    const notVulnerable = report.summary.vulnerabilities.filter(
      (v: any) => !v.vulnerable,
    );
    expect(vulnerable.length).toBeGreaterThan(0);
    expect(notVulnerable.length).toBeGreaterThan(0);
  });

  test('`redteam get` report includes scan summary', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804 --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    const report = JSON.parse(extractJSON(result.stdout));
    expect(report.summary).toBeDefined();
    expect(report.summary.vulnerabilities).toHaveLength(2);
    expect(report.summary.vulnerabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'system-prompt-exfiltration',
          vulnerable: true,
        }),
        expect.objectContaining({
          slug: 'prompt-injection',
          vulnerable: false,
        }),
      ]),
    );
  });

  test('`redteam --html` includes summary data in HTML report', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --html --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('<!doctype html>');
    expect(result.stdout).toContain('system-prompt-exfiltration');
    expect(result.stdout).toContain('prompt-injection');
  });

  test('`redteam get --html` includes summary data in HTML report', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --id=59622253-75f3-4439-ac1e-ce94834c5804 --html --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('<!doctype html>');
    expect(result.stdout).toContain('system-prompt-exfiltration');
    expect(result.stdout).toContain('prompt-injection');
  });

  test('`redteam --html-file-output` includes summary data in file', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'snyk-redteam-'));
    const htmlFile = join(tmpDir, 'report.html');
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --html-file-output=${htmlFile} --tenant-id=${tenantId} --target-url=${targetURL}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    const html = readFileSync(htmlFile, 'utf-8');
    expect(html).toContain('system-prompt-exfiltration');
    expect(html).toContain('prompt-injection');
  });

  test('`redteam get` fails without --id flag', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(2);
    expect(result.stdout).toContain('No scan ID');
  });

  test('`redteam get` fails with invalid UUID', async () => {
    const result = await runSnykCLI(
      `redteam get --experimental --id=not-a-uuid --tenant-id=${tenantId}`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(2);
    expect(result.stdout).toContain('not a valid UUID');
  });

  test('`redteam --list-profiles` lists available profiles', async () => {
    const result = await runSnykCLI(`redteam --experimental --list-profiles`, {
      env,
    });
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('Available profiles');
    expect(result.stdout).toContain('fast');
    expect(result.stdout).toContain('security');
  });

  test('`redteam --list-goals` lists available goals', async () => {
    const result = await runSnykCLI(`redteam --experimental --list-goals`, {
      env,
    });
    expect(result).toHaveExitCode(0);
    expect(result.stdout).toContain('Available goals');
    expect(result.stdout).toContain('system_prompt_extraction');
    expect(result.stdout).toContain('prompt_injection');
  });

  test('`redteam --goals` runs scan with specified goals', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL} --goals=system_prompt_extraction`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    let report: any;
    expect(() => {
      report = JSON.parse(extractJSON(result.stdout));
    }).not.toThrow();
    expect(report.id).toBeDefined();
    expect(report.results).toBeDefined();

    const requests = server
      .getRequests()
      .filter((req) => req.url?.includes('/hidden/profiles'));
    expect(requests).toHaveLength(0);
  });

  test('`redteam --profile` runs scan with specified profile', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL} --profile=security`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(0);

    let report: any;
    expect(() => {
      report = JSON.parse(extractJSON(result.stdout));
    }).not.toThrow();
    expect(report.id).toBeDefined();
    expect(report.results).toBeDefined();
  });

  test('`redteam --goals --profile` fails with both flags', async () => {
    const result = await runSnykCLI(
      `redteam --config=${redteamTarget} --experimental --tenant-id=${tenantId} --target-url=${targetURL} --goals=system_prompt_extraction --profile=fast`,
      {
        env,
      },
    );
    expect(result).toHaveExitCode(2);
    expect(result.stdout).toContain('cannot be used together');
  });
});

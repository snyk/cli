import { promises as fs } from 'fs';
import { join } from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { makeTmpDirectory } from '../../../utils';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { getFixturePath } from '../../util/getFixturePath';
import { expectValidHtml, htmlDoctype } from '../../util/expectValidHtml';

jest.setTimeout(60_000);

async function readFixture(name: string) {
  const file = getFixturePath(join('secrets', 'html', name));
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

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
        server.setEndpointResponse(
          testPath,
          await readFixture(`test-${count}-findings.json`),
        );
        server.setEndpointResponse(
          `${testPath}/findings`,
          await readFixture(`findings-${count}.json`),
        );
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
        expectValidHtml(output);
        if (flag !== '--html') {
          expect(stdout).not.toMatch(htmlDoctype);
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

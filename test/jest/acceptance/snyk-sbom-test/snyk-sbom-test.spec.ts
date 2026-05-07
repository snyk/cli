import * as fs from 'fs';
import * as path from 'path';

import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { getFixturePath } from '../../util/getFixturePath';
import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { testIf } from '../../../utils';

jest.setTimeout(1000 * 60 * 5);

const hasBinary = !!process.env.TEST_SNYK_COMMAND;

// Org ID returned by the fake server's /rest/self endpoint.
const FAKE_SERVER_ORG_ID = '55555555-5555-5555-5555-555555555555';
// Test ID the fake server assigns via the test_jobs 303 redirect.
const FAKE_SERVER_TEST_ID = 'aaaaaaaa-bbbb-cccc-dddd-000000000002';

describe('snyk sbom test (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  testIf(hasBinary)(
    '`sbom test` succeeds for a uv CycloneDX SBOM',
    async () => {
      server.setFeatureFlag('enableUvCLI', true);

      const findingsResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(getFixturePath('sbom'), 'uv-findings-response.json'),
          'utf8',
        ),
      );
      server.setEndpointResponse(
        `/rest/orgs/${FAKE_SERVER_ORG_ID}/tests/${FAKE_SERVER_TEST_ID}/findings`,
        findingsResponse,
      );

      const sbomFilePath = getFixturePath('sbom/uv-sbom-cdx15.json');
      const { code, stdout, stderr } = await runSnykCLI(
        `sbom test --file=${sbomFilePath}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(stdout).not.toContain('no semver library defined for ecosystem');
      expect(stdout).toContain('Test Summary');
      expect(stdout).toContain('Issues to fix by upgrading');
      expect(code).toBe(EXIT_CODES.VULNS_FOUND);
    },
  );
});

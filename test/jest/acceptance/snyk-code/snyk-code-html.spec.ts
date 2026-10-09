import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { makeTmpDirectory } from '../../../utils';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { expectValidHtml, htmlDoctype } from '../../util/expectValidHtml';

jest.setTimeout(1000 * 120);

const projectRoot = resolve(__dirname, '../../../..');
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_ACTION_NEEDED = 1;

describe('snyk code test HTML output', () => {
  const orgId = '11111111-2222-3333-4444-555555555555';
  const baseApi = '/api/v1';
  const projectWithCodeIssues = resolve(
    projectRoot,
    'test/fixtures/sast/with_code_issues',
  );
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let env: Record<string, string>;
  let outputDirectory: string;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    deepCodeServer = fakeDeepCodeServer();
    await new Promise<void>((resolve) =>
      deepCodeServer.listen(() => resolve()),
    );
    server = fakeServer(baseApi, 'snykToken');
    await server.listenPromise(port);
    env = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_CFG_ORG: orgId,
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_CODE_CLIENT_PROXY_URL: `http://localhost:${deepCodeServer.getPort()}`,
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
    };
  });

  beforeEach(async () => {
    server.setOrgSetting('sast', true);
    server.setLocalCodeEngineConfiguration({
      enabled: true,
      allowCloudUpload: true,
      url: `http://localhost:${deepCodeServer.getPort()}`,
    });
    outputDirectory = await makeTmpDirectory();
  });

  afterEach(async () => {
    server.restore();
    deepCodeServer.restore();
    await fs.rm(outputDirectory, { recursive: true, force: true });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => deepCodeServer.close(() => resolve()));
    await server.closePromise();
  });

  describe.each([
    {
      name: 'with findings',
      sarif: require('../../../fixtures/sast/sample-sarif.json'),
      expectedExitCode: EXIT_CODE_ACTION_NEEDED,
    },
    {
      name: 'without findings',
      sarif: require('../../../fixtures/sast/empty-sarif.json'),
      expectedExitCode: EXIT_CODE_SUCCESS,
    },
  ])('$name', ({ sarif, expectedExitCode }) => {
    beforeEach(() => {
      deepCodeServer.setFiltersResponse({
        configFiles: [],
        extensions: ['.java'],
      });
      deepCodeServer.setSarifResponse(sarif);
    });

    it('--html prints a valid HTML document', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `code test ${projectWithCodeIssues} --html`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(expectedExitCode);
      expectValidHtml(stdout);
    });

    it('--html-file-output writes a valid HTML document', async () => {
      const filePath = join(outputDirectory, 'result.html');

      const { code, stdout, stderr } = await runSnykCLI(
        `code test ${projectWithCodeIssues} --html-file-output=${filePath}`,
        { env },
      );

      expect(stderr).toBe('');
      expect(code).toBe(expectedExitCode);
      expectValidHtml(await fs.readFile(filePath, 'utf8'));
      expect(stdout).not.toMatch(htmlDoctype);
    });
  });
});

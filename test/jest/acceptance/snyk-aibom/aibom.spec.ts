import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getServerPort } from '../../util/getServerPort';
import { resolve } from 'path';

import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';

jest.setTimeout(1000 * 60 * 5);

describe('snyk aibom (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let env: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';
  const initialEnvVars = {
    ...process.env,
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
    SNYK_TOKEN: '123456789',
  };
  const projectRoot = resolve(__dirname, '../../../..');
  const pythonChatbotProject = resolve(
    projectRoot,
    'test/fixtures/ai-bom/python-chatbot',
  );

  beforeAll(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        let serversReady = 0;
        const totalServers = 2;
        const checkAndResolve = () => {
          serversReady++;
          if (serversReady === totalServers) {
            resolve();
          }
        };

        deepCodeServer = fakeDeepCodeServer();
        deepCodeServer.listen(checkAndResolve);

        env = {
          ...initialEnvVars,
          SNYK_CODE_CLIENT_PROXY_URL: `http://localhost:${deepCodeServer.getPort()}`,
        };
        server = fakeServer(baseApi, 'snykToken');
        deepCodeServer.setFiltersResponse({
          configFiles: [],
          extensions: ['.py'],
          autofixExtensions: [],
        });
        const sarifPayload = require('../../../fixtures/ai-bom/sample-ai-bom-sarif.json');
        deepCodeServer.setSarifResponse(sarifPayload);
        server.listen(port, checkAndResolve);
      } catch (error) {
        reject(error);
      }
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
    deepCodeServer.restore();
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      deepCodeServer.close(() => {
        server.close(() => {
          resolve();
        });
      });
    });
  });

  test('`aibom` generates an AI-BOM CycloneDX with components', async () => {
    const { code, stdout } = await runSnykCLI(
      `aibom ${pythonChatbotProject} --experimental`,
      {
        env,
      },
    );
    let bom: any;
    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    expect(bom).toMatchObject({
      $schema: 'https://cyclonedx.org/schema/bom-1.6.schema.json',
      specVersion: '1.6',
      bomFormat: 'CycloneDX',
    });
    expect(bom.components.length).toBeGreaterThan(1);
  });
});

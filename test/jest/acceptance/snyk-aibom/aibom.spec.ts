import { runSnykCLI } from '../../util/runSnykCLI';
import { Request } from 'express';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { getServerPort } from '../../util/getServerPort';
import { resolve } from 'path';

jest.setTimeout(1000 * 60 * 5);

function aiBomRestEndpointRequests(requests: Request[]): string[] {
  const res: string[] = [];
  for (const request of requests) {
    if (request.url.includes('/ai_boms/upload')) {
      res.push(`${request.method}:/ai_boms/upload`);
    } else if (request.url.includes('/ai_boms')) {
      res.push(`${request.method}:/ai_boms`);
    } else if (request.url.includes('/ai_bom_jobs')) {
      res.push(`${request.method}:/ai_bom_jobs`);
    } else if (request.url.match(/.*\/upload_revisions\/.*\/files/)) {
      res.push(`${request.method}:/upload_revisions/:uploadRevisionId/files`);
    } else if (request.url.match(/.*\/upload_revisions\/.*/)) {
      res.push(`${request.method}:/upload_revisions/:uploadRevisionId`);
    } else if (request.url.match(/.*\/upload_revisions/)) {
      res.push(`${request.method}:/upload_revisions`);
    }
  }
  return res;
}

describe('snyk aibom (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let envWithoutAuth: Record<string, string>;
  let env: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';
  const ipAddress = getFirstIPv4Address();
  const initialEnvVarsWithoutAuth = {
    ...process.env,
    SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
    SNYK_HOST: `http://${ipAddress}:${port}`,
    TEST_SNYK_TOKEN: 'UNSET',
    SNYK_HTTP_PROTOCOL_UPGRADE: '0',
  };
  const initialEnvVars = {
    ...process.env,
    SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
    SNYK_HOST: `http://${ipAddress}:${port}`,
    SNYK_TOKEN: '123456789',
    SNYK_CFG_ORG: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    SNYK_HTTP_PROTOCOL_UPGRADE: '0',
  };

  const projectRoot = resolve(__dirname, '../../../..');
  const pythonChatbotProject = resolve(
    projectRoot,
    'test/fixtures/ai-bom/python-chatbot',
  );

  const notSupportedProject = resolve(
    projectRoot,
    'test/fixtures/ai-bom/not-supported',
  );

  beforeAll(() => {
    return new Promise<void>((resolve, reject) => {
      try {
        let serversReady = 0;
        const totalServers = 1;
        const checkAndResolve = () => {
          serversReady++;
          if (serversReady === totalServers) {
            resolve();
          }
        };

        server = fakeServer(baseApi, 'snykToken');
        server.listen(port, checkAndResolve);
      } catch (error) {
        reject(error);
      }
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    server.restore();
    env = {
      ...initialEnvVars,
    };
    envWithoutAuth = {
      ...initialEnvVarsWithoutAuth,
    };
  });

  test('`aibom` generates an AI-BOM CycloneDX with components', async () => {
    expect(server.getRequests().length).toEqual(0);
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

    const aiBomRequests = aiBomRestEndpointRequests(server.getRequests());
    expect(aiBomRequests).toEqual([
      'POST:/ai_boms',
      'POST:/upload_revisions',
      'POST:/upload_revisions/:uploadRevisionId/files',
      'PATCH:/upload_revisions/:uploadRevisionId',
      'POST:/ai_boms',
      'GET:/ai_bom_jobs',
      'GET:/ai_boms',
    ]);

    expect(bom).toMatchObject({
      $schema: 'https://cyclonedx.org/schema/bom-1.6.schema.json',
      specVersion: '1.6',
      bomFormat: 'CycloneDX',
    });
    expect(bom.components.length).toBeGreaterThan(1);
  });

  test('`aibom` uses upload endpoint if --upload flag is set', async () => {
    expect(server.getRequests().length).toEqual(0);
    const { code, stdout } = await runSnykCLI(
      `aibom ${pythonChatbotProject} --experimental --upload --repo "python-chatbot"`,
      {
        env,
      },
    );
    let bom: any;
    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    const aiBomRequests = aiBomRestEndpointRequests(server.getRequests());
    expect(aiBomRequests).toEqual([
      'POST:/ai_boms',
      'POST:/upload_revisions',
      'POST:/upload_revisions/:uploadRevisionId/files',
      'PATCH:/upload_revisions/:uploadRevisionId',
      'POST:/ai_boms/upload',
      'GET:/ai_bom_jobs',
      'GET:/ai_boms',
    ]);

    expect(bom).toMatchObject({
      $schema: 'https://cyclonedx.org/schema/bom-1.6.schema.json',
      specVersion: '1.6',
      bomFormat: 'CycloneDX',
    });
    expect(bom.components.length).toBeGreaterThan(1);
  });

  test('`aibom` fails if api is unavailable', async () => {
    expect(server.getRequests().length).toEqual(0);
    server.setStatusCode(404);
    const { code, stdout } = await runSnykCLI(
      `aibom ${pythonChatbotProject} --experimental`,
      {
        env,
      },
    );
    expect(code).toEqual(2);

    const aiBomRequests = aiBomRestEndpointRequests(server.getRequests());
    expect(aiBomRequests).toEqual(['POST:/ai_boms']);

    expect(stdout).toContain('unexpected status code 404 for CreateAIBOM');
  });

  test('`aibom` generates an AI-BOM CycloneDX in the HTML format', async () => {
    const { code, stdout } = await runSnykCLI(
      `aibom ${pythonChatbotProject} --experimental --html`,
      {
        env,
      },
    );
    expect(code).toEqual(0);
    expect(stdout).toContain('<!DOCTYPE html>');
    expect(stdout).toContain(
      'https://cyclonedx.org/schema/bom-1.6.schema.json',
    );
  });

  describe('aibom error handling', () => {
    test('handles a missing experimental flag', async () => {
      const { code, stdout } = await runSnykCLI(
        `aibom ${pythonChatbotProject}`,
        {
          env,
        },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('Command is experimental (SNYK-CLI-0015)');
    });

    test('handles unauthenticated', async () => {
      expect(server.getRequests().length).toEqual(0);
      server.setStatusCode(401);
      const { code, stdout } = await runSnykCLI(
        `aibom ${pythonChatbotProject} --experimental`,
        {
          env,
        },
      );
      const aiBomRequests = aiBomRestEndpointRequests(server.getRequests());
      expect(aiBomRequests).toEqual(['POST:/ai_boms']);
      expect(code).toEqual(2);
      expect(stdout).toContain('Authentication error (SNYK-0005)');
    });

    test('handles org has no access', async () => {
      expect(server.getRequests().length).toEqual(0);
      server.setStatusCode(403);
      const { code, stdout } = await runSnykCLI(
        `aibom ${pythonChatbotProject} --experimental`,
        {
          env,
        },
      );
      const aiBomRequests = aiBomRestEndpointRequests(server.getRequests());
      expect(aiBomRequests).toEqual(['POST:/ai_boms']);
      expect(code).toEqual(2);
      expect(stdout).toContain('Forbidden (SNYK-AIBOM-0002)');
    });

    test('handles an unsupported project', async () => {
      const { code, stdout } = await runSnykCLI(
        `aibom ${notSupportedProject} --experimental`,
        {
          env,
        },
      );
      expect(code).toEqual(3);
      expect(stdout).toContain('No supported files (SNYK-AIBOM-0003)');
    });

    test('handles no SNYK_TOKEN', async () => {
      const { code, stdout } = await runSnykCLI(
        `aibom ${pythonChatbotProject} --experimental`,
        {
          env: envWithoutAuth,
        },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('Authentication error (SNYK-0005)');
    });
  });
});

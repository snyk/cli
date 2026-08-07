import * as fs from 'fs';
import * as path from 'path';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getFixturePath } from '../../util/getFixturePath';
import { getServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('unmanaged test', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  const loadFixture = async (fixtureName: string) => {
    const fixturePath = path.resolve(getFixturePath('unmanaged'), fixtureName);
    return JSON.parse(await fs.promises.readFile(fixturePath, 'utf-8'));
  };

  const createIgnorePolicy = async (
    projectPath: string,
    issueId: string,
    reason: string,
  ) => {
    const policyContent = `
# Snyk (https://snyk.io) policy file
version: v1.19.0
ignore:
  '${issueId}':
    - '*':
        reason: ${reason}
        expires: '3026-01-01T00:00:00.000Z'
        created: '2024-01-01T00:00:00.000Z'
`;
    await fs.promises.writeFile(path.join(projectPath, '.snyk'), policyContent);
  };

  test('unmanaged issues returned by the backend', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    server.setCustomResponse(await loadFixture('test-dep-graph-result.json'));

    const { code, stdout } = await runSnykCLI('test --unmanaged', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(1);
    expect(stdout).toContain('SNYK-UNMANAGED-CPIO-2319543');
    expect(stdout).toContain('https://ftp.gnu.org|cpio@2.12');
  });

  test('unmanaged issues ignored when .snyk exists', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    await createIgnorePolicy(
      project.path(),
      'SNYK-UNMANAGED-CPIO-2319543',
      'Test ignore',
    );

    server.setCustomResponse(await loadFixture('test-dep-graph-result.json'));

    const { code, stdout } = await runSnykCLI('test --unmanaged', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).not.toContain('SNYK-UNMANAGED-CPIO-2319543');
    expect(stdout).not.toContain('https://ftp.gnu.org|cpio@2.12');
  });

  test('unmanaged JSON output includes unmanaged issues returned by the backend', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    server.setCustomResponse(await loadFixture('test-dep-graph-result.json'));

    const { stdout } = await runSnykCLI('test --unmanaged --json', {
      cwd: project.path(),
      env,
    });

    const jsonOutput = JSON.parse(stdout);
    expect(jsonOutput).toBeInstanceOf(Array);
    expect(jsonOutput).toHaveLength(1);

    const result = jsonOutput[0];

    expect(result.filtered).toBeDefined();
    expect(result.filtered.ignore).toBeDefined();
    expect(result.filtered.ignore).toBeInstanceOf(Array);
    expect(result.filtered.ignore).toHaveLength(0);

    expect(result.vulnerabilities).toBeDefined();
    expect(result.vulnerabilities.length).toEqual(1);
  });

  test('unmanaged JSON output includes ignored issues when .snyk exists', async () => {
    const project = await createProjectFromWorkspace('unmanaged');
    await createIgnorePolicy(
      project.path(),
      'SNYK-UNMANAGED-CPIO-2319543',
      'Test ignore for JSON output',
    );

    server.setCustomResponse(await loadFixture('test-dep-graph-result.json'));

    const { code, stdout } = await runSnykCLI('test --unmanaged --json', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const jsonOutput = JSON.parse(stdout);
    expect(jsonOutput).toBeInstanceOf(Array);
    expect(jsonOutput).toHaveLength(1);

    const result = jsonOutput[0];

    expect(result.filtered).toBeDefined();
    expect(result.filtered.ignore).toBeDefined();
    expect(result.filtered.ignore).toHaveLength(1);
    expect(result.filtered.ignore[0]).toMatchObject({
      id: 'SNYK-UNMANAGED-CPIO-2319543',
      packageManager: 'Unmanaged (C/C++)',
      from: ['https://ftp.gnu.org|cpio@2.12'],
    });

    expect(result.vulnerabilities).toHaveLength(0);
  });
});

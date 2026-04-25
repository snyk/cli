import * as fs from 'fs';
import * as path from 'path';
import { createProject } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { getFixturePath } from '../../util/getFixturePath';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom uv (mocked server only)', () => {
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

  beforeEach(() => {
    server.setFeatureFlag('enableUvCLI', true);

    const body = fs.readFileSync(
      path.resolve(getFixturePath('sbom'), 'sbom-convert-response-uv.json'),
      'utf8',
    );
    const orgId = '55555555-5555-5555-5555-555555555555';
    server.setEndpointResponse(
      `/hidden/orgs/${orgId}/sboms/convert`,
      JSON.parse(body),
    );
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

  test('`sbom` generates an SBOM for a uv project - CycloneDX 1.6 JSON', async () => {
    const project = await createProject('uv-acceptance');

    const { code, stdout } = await runSnykCLI(
      `sbom --org 55555555-5555-5555-5555-555555555555 --format cyclonedx1.6+json --debug`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom: any;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    expect(bom.specVersion).toEqual('1.6');
    expect(bom['$schema']).toEqual(
      'http://cyclonedx.org/schema/bom-1.6.schema.json',
    );
    expect(bom.metadata.component.name).toEqual('demo');
    expect(bom.components.length).toBeGreaterThan(0);
    // Verify that uv dependencies are included
    const componentNames = bom.components.map((c: any) => c.name);
    expect(componentNames).toContain('requests');
    expect(componentNames).toContain('urllib3');
  });

  test('`sbom` generates an SBOM for a uv project - CycloneDX 1.4 XML', async () => {
    const project = await createProject('uv-acceptance');

    const { code, stdout } = await runSnykCLI(
      `sbom --org 55555555-5555-5555-5555-555555555555 --format cyclonedx1.4+xml --debug`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toContain('specVersion="1.4"');
    expect(stdout).toContain('<name>demo</name>');
    // Verify that uv dependencies are included
    expect(stdout).toContain('<name>requests</name>');
    expect(stdout).toContain('<name>urllib3</name>');
  });

  test('`sbom` generates an SBOM for a uv project - SPDX 2.3 JSON', async () => {
    const project = await createProject('uv-acceptance');

    const { code, stdout } = await runSnykCLI(
      `sbom --org 55555555-5555-5555-5555-555555555555 --format spdx2.3+json --debug`,
      {
        cwd: project.path(),
        env,
      },
    );
    let spdx: any;

    expect(code).toEqual(0);
    expect(() => {
      spdx = JSON.parse(stdout);
    }).not.toThrow();

    expect(spdx.spdxVersion).toEqual('SPDX-2.3');
    expect(spdx.name).toEqual('demo');
    expect(spdx.packages).toBeDefined();
    expect(spdx.packages.length).toBeGreaterThan(0);
    // Verify that uv dependencies are included
    const packageNames = spdx.packages.map((p: any) => p.name);
    expect(packageNames).toContain('requests');
    expect(packageNames).toContain('urllib3');
  });
});

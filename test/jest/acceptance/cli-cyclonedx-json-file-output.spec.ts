import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('sbom --cyclonedx-json-file-output', () => {
  let env: Record<string, string>;

  beforeAll(() => {
    env = {
      ...process.env,
      SNYK_DISABLE_ANALYTICS: '1',
    };
  });

  it('sbom with --cyclonedx-json returns without error and with JSON return type', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    const { code, stdout } = await runSnykCLI(`sbom --cyclonedx-json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const outputObj = JSON.parse(stdout);
    expect(outputObj).not.toBe('');
  });

  it('sbom without --cyclonedx-json returns without error and with a string return type', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');

    const { code, stdout } = await runSnykCLI(`sbom`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(stdout).not.toBe('');
    expect(typeof stdout).toBe('string');
  });

  it('can save JSON output to file while sending human readable output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `sbom --cyclonedx-json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toMatch('package.json: Found 1 npm dependencies');
    expect(await project.readJSON(outputPath)).toMatchObject({
      $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
      bomFormat: 'CycloneDX',
      components: [
        {
          'bom-ref': 'package.json:pkg:npm/no-vulns@1.0.0',
          name: 'no-vulns',
          purl: 'pkg:npm/no-vulns@1.0.0',
          type: 'library',
          version: '1.0.0',
          properties: [
            {
              name: 'snyk:package_manager:name',
              value: 'npm',
            },
            {
              name: 'snyk:source_file:path',
              value: 'package.json',
            },
          ],
        },
      ],
      dependencies: [
        {
          ref: 'package.json:pkg:npm/no-vulns@1.0.0',
        },
      ],
      metadata: {
        tools: [
          {
            name: 'snyk-cli',
            vendor: 'Snyk',
            version: '1.0.0-monorepo',
          },
        ],
      },
      specVersion: '1.4',
      version: 1,
    });
  });

  it('sbom --cyclonedx-json-file-output produces same JSON output as normal JSON output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `sbom --cyclonedx-json --cyclonedx-json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(await project.read(outputPath)).toEqual(stdout);
  });
});

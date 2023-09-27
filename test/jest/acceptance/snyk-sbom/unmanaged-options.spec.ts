import { runSnykCLI } from '../../util/runSnykCLI';
import { createProjectFromFixture } from '../../util/createProject';
import * as path from 'path';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: unmanaged options', () => {
  test('`sbom --max-depth=1` generates an SBOM includind the dependencies within the archive', async () => {
    const project = await createProjectFromFixture(
      path.join('unmanaged', 'extraction'),
    );

    const { code, stdout } = await runSnykCLI(
      `sbom --unmanaged --max-depth=1 --format=cyclonedx1.4+json --org=${process.env.TEST_SNYK_ORG_SLUGNAME} --debug`,
      {
        cwd: project.path(),
      },
    );

    expect(code).toEqual(0);

    let sbom;
    expect(() => {
      sbom = JSON.parse(stdout);
    }).not.toThrow();

    expect(sbom.metadata.component.name).toEqual('root-node');
    expect(sbom.components.length).toBeGreaterThanOrEqual(1);
  });
});

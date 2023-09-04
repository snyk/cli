import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

export async function runSnykSbomCliCycloneDxJsonForFixture(
  fixtureName: string,
  options: string,
  env: Record<string, string>,
): Promise<any> {
  const project = await createProjectFromFixture(fixtureName);

  const { code, stdout, stderr } = await runSnykCLI(
    `sbom --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format=cyclonedx1.4+json --debug ${options}`,
    {
      cwd: project.path(),
      env,
    },
  );

  if (code) {
    console.log(stderr);
  }

  expect(code).toEqual(0);

  let sbom;
  expect(() => {
    sbom = JSON.parse(stdout);
  }).not.toThrow();

  return sbom;
}

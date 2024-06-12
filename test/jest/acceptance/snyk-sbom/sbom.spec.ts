import { createProjectFromWorkspace } from "../../util/createProject";
import { runSnykCLI } from "../../util/runSnykCLI";
import { fakeServer } from "../../../acceptance/fake-server";
import * as fs from "fs";

jest.setTimeout(1000 * 60 * 5);

describe("snyk sbom (mocked server only)", () => {
  let server;
  let env: Record<string, string>;

  beforeAll(done => {
    const port = process.env.PORT || process.env.SNYK_PORT || "58584";
    const baseApi = "/api/v1";
    env = {
      ...process.env,
      SNYK_API: "http://localhost:" + port + baseApi,
      SNYK_HOST: "http://localhost:" + port,
      SNYK_TOKEN: "123456789",
      SNYK_DISABLE_ANALYTICS: "1"
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(done => {
    server.close(() => {
      done();
    });
  });

  test("`sbom` generates an SBOM for a single project - CycloneDX 1.4", async () => {
    const project = await createProjectFromWorkspace("npm-package");

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug`,
      {
        cwd: project.path(),
        env
      }
    );
    let bom: any;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    expect(bom.specVersion).toEqual("1.4");
    expect(bom["$schema"]).toEqual(
      "http://cyclonedx.org/schema/bom-1.4.schema.json"
    );
    expect(bom.metadata.component.name).toEqual("npm-package");
    expect(bom.components).toHaveLength(3);
  });

  test("`sbom` includes a tool name in the document - CycloneDX 1.4", async () => {
    const project = await createProjectFromWorkspace("npm-package");

    const { stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug`,
      {
        cwd: project.path(),
        env
      }
    );
    const bom = JSON.parse(stdout);

    expect(bom.metadata.tools).toEqual(
      expect.arrayContaining([
        {
          vendor: "Snyk",
          name: "snyk-cli",
          version: expect.any(String)
        }
      ])
    );
  });

  test("`sbom` is written to a file - CycloneDX 1.4", async () => {
    const project = await createProjectFromWorkspace("npm-package");

    const { code } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --json-file-output sbom.json`,
      {
        cwd: project.path(),
        env
      }
    );

    expect(code).toEqual(0);

    const sbomFileContent = fs.readFileSync(
      project.path() + "/sbom.json",
      "utf8"
    );
    const bom = JSON.parse(sbomFileContent);
    expect(bom.metadata.tools).toEqual(
      expect.arrayContaining([
        {
          vendor: "Snyk",
          name: "snyk-cli",
          version: expect.any(String)
        }
      ])
    );
  });

  test("`sbom` generates an SBOM for a single project - CycloneDX 1.5", async () => {
    const project = await createProjectFromWorkspace("npm-package");

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.5+json --debug`,
      {
        cwd: project.path(),
        env
      }
    );
    let bom: any;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    expect(bom.specVersion).toEqual("1.5");
    expect(bom["$schema"]).toEqual(
      "http://cyclonedx.org/schema/bom-1.5.schema.json"
    );
    expect(bom.metadata.component.name).toEqual("npm-package");
    expect(bom.components).toHaveLength(3);
  });

  test("`sbom` includes a tool name in the document - CycloneDX 1.5", async () => {
    const project = await createProjectFromWorkspace("npm-package");

    const { stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.5+json --debug`,
      {
        cwd: project.path(),
        env
      }
    );
    const bom = JSON.parse(stdout);

    expect(bom.metadata.tools.components).toEqual(
      expect.arrayContaining([
        {
          vendor: "Snyk",
          name: "snyk-cli",
          version: expect.any(String)
        }
      ])
    );

    expect(bom.metadata.tools.services).toEqual(
      expect.arrayContaining([
        {
          name: "fake-server",
          version: expect.any(String)
        }
      ])
    );
  });
});

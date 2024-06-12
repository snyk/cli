import { runSnykCLI } from "../../util/runSnykCLI";
import { fakeServer } from "../../../acceptance/fake-server";
import { getServerPort } from "../../util/getServerPort";
import { getFixturePath } from "../../util/getFixturePath";
import * as path from "path";

jest.setTimeout(1000 * 60);

describe("snyk sbom test (mocked server only)", () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(done => {
    const port = getServerPort(process);
    const baseApi = "";
    env = {
      ...process.env,
      SNYK_API: "http://localhost:" + port + baseApi,
      SNYK_API_REST_URL: "http://localhost:" + port + baseApi,
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

  test("`npm CycloneDX JSON`", async () => {
    const fileToTest = path.resolve(
      getFixturePath("sbom"),
      "npm-sbom-cdx15.json"
    );

    const {
      code,
      stdout,
      stderr
    } = await runSnykCLI(
      `sbom test --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --experimental --file ${fileToTest}`,
      { env }
    );

    expect(stdout).toMatch(
      "[MEDIUM] Regular Expression Denial of Service (ReDoS)"
    );
    expect(stdout).toMatch("Introduced through: pkg:npm/minimatch@3.0.4");
    expect(stdout).toMatch(
      "URL: https://security.snyk.io/vuln/SNYK-JS-MINIMATCH-3050818"
    );

    expect(stdout).toMatch(
      "[HIGH] Regular Expression Denial of Service (ReDoS)"
    );
    expect(stdout).toMatch("Introduced through: pkg:npm/semver@7.3.5");
    expect(stdout).toMatch(
      "URL: https://security.snyk.io/vuln/SNYK-JS-SEMVER-3247795"
    );

    expect(code).toEqual(1);

    expect(stderr).toEqual("");
  });

  test("`missing experimental flag`", async () => {
    const fileToTest = path.resolve(
      getFixturePath("sbom"),
      "npm-sbom-cdx15.json"
    );

    const {
      stdout,
      stderr
    } = await runSnykCLI(
      `sbom test --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --file ${fileToTest}`,
      { env }
    );

    expect(stdout).toMatch(
      "Flag `--experimental` is required to execute this command."
    );

    expect(stderr).toEqual("");
  });

  test("`missing file flag`", async () => {
    const {
      stdout,
      stderr
    } = await runSnykCLI(
      `sbom test --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --experimental`,
      { env }
    );

    expect(stdout).toMatch(
      "Flag `--file` is required to execute this command. Value should point to a valid SBOM document."
    );

    expect(stderr).toEqual("");
  });
});

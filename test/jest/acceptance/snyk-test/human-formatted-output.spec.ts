import { fakeServer } from "../../../acceptance/fake-server";
import { createProjectFromWorkspace } from "../../util/createProject";
import { getServerPort } from "../../util/getServerPort";
import { runSnykCLI } from "../../util/runSnykCLI";
const stripAnsi = require("strip-ansi");

jest.setTimeout(1000 * 60);

describe("test formatting for human consumption", () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(done => {
    const apiPath = "/api/v1";
    const apiPort = getServerPort(process);
    env = {
      ...process.env,
      SNYK_API: "http://localhost:" + apiPort + apiPath,
      SNYK_TOKEN: "123456789",
      SNYK_DISABLE_ANALYTICS: "1"
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(done => {
    server.close(() => done());
  });

  it("includes a summary of vulnerabilites and paths", async () => {
    const project = await createProjectFromWorkspace("npm-package-single-vuln");
    server.setCustomResponse(await project.readJSON("test-graph-results.json"));

    const { code, stdout } = await runSnykCLI(`test`, {
      cwd: project.path(),
      env
    });

    expect(code).toEqual(1);
    expect(stripAnsi(stdout)).toContain(
      "Tested 1 dependencies for known issues, found 1 issue, 1 vulnerable path."
    );
    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
  });

  it("includes a user note and reason", async () => {
    const project = await createProjectFromWorkspace("npm-package-single-vuln");
    server.setCustomResponse(
      await project.readJSON("test-graph-results-with-annotation.json")
    );

    const { code, stdout } = await runSnykCLI(`test`, {
      cwd: project.path(),
      env
    });

    expect(code).toEqual(1);
    expect(stripAnsi(stdout)).toContain("User note: This is a test user note");
    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
  });
});

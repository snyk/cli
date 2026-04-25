import type { DepGraphData } from '@snyk/dep-graph';

import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { createProjectFromWorkspace } from '../../util/createProject';

jest.setTimeout(1000 * 60);

/**
 * snyk-go-plugin normalizes ImportPath values by stripping Go compiler variant
 * annotations (suffix after the first space) before building package identifiers.
 * Without this, dep graph nodes can carry raw annotated paths and fail to match
 * the vulnerability database.
 *
 * These tests assert the happy path: identifiers in CLI output stay
 * space-free so dependency matching remains stable for users.
 *
 * Note: default `snyk test --json` stdout does not include `depGraph`; the
 * CLI adds it to JSON when using `--print-deps` with `--json-file-output`
 * (see snyk-test/legacy `convertTestDepGraphResultToLegacy`). The file-based
 * test below asserts per-package ids from that JSON, matching how other
 * ecosystems cover package identifiers in acceptance tests.
 */
describe('Go import path normalization (user journey)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    const host = `http://${getFirstIPv4Address()}:${port}`;
    env = {
      ...process.env,
      SNYK_API: host + baseApi,
      SNYK_HOST: host,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.setFeatureFlag('disableGoPackageUrlsInCli', false);
    await server.listenPromise(port);
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

  it('dep graph package ids and names have no spaces (normalized import paths)', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-normalize-importpath',
    );
    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const depGraphJSON = stdout
      .split('DepGraph data:')[1]
      ?.split('DepGraph target:')[0];
    expect(depGraphJSON).toBeDefined();
    const depGraph: DepGraphData = JSON.parse(depGraphJSON!);

    for (const { id, info } of depGraph.pkgs) {
      expect(id).not.toMatch(/\s/);
      if (info?.name) {
        expect(info.name).not.toMatch(/\s/);
      }
    }
  });

  it('snyk test --json completes successfully for gomodules with dependency metadata', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-normalize-importpath',
    );
    const { code, stdout } = await runSnykCLI('test --json', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    const result = JSON.parse(stdout) as {
      ok: boolean;
      packageManager?: string;
      dependencyCount: number;
      vulnerabilities: Array<{ name?: string }>;
      projectName?: string;
      path?: string;
    };

    expect(result.ok).toEqual(true);
    expect(result.packageManager).toEqual('gomodules');
    expect(result.dependencyCount).toBeGreaterThan(0);
    expect(Array.isArray(result.vulnerabilities)).toEqual(true);

    // Root module id from go.mod (`module app`) — stable package identifier in JSON.
    expect(result.projectName).toEqual('app');
    expect(result.projectName).not.toMatch(/\s/);
    expect(result.path).toBeDefined();

    for (const vuln of result.vulnerabilities) {
      if (vuln.name) {
        expect(vuln.name).not.toMatch(/\s/);
      }
    }
  });

  it('vulnerability names in JSON have no spaces when the API returns issues', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-normalize-importpath',
    );
    server.setCustomResponse(
      await project.readJSON('test-dep-graph-with-vuln.json'),
    );

    const { code, stdout } = await runSnykCLI('test --json', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(1);
    const result = JSON.parse(stdout) as {
      vulnerabilities: Array<{ name?: string }>;
    };

    expect(result.vulnerabilities.length).toBeGreaterThan(0);
    for (const vuln of result.vulnerabilities) {
      if (vuln.name) {
        expect(vuln.name).not.toMatch(/\s/);
      }
    }
  });

  it('snyk test JSON output includes dep graph package identifiers (json-file-output)', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-normalize-importpath',
    );
    const outputPath = 'go-import-path-json-depgraph.json';
    const { code } = await runSnykCLI(
      `test --print-deps --json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);

    const json = (await project.readJSON(outputPath)) as {
      depGraph?: DepGraphData;
    };

    expect(json.depGraph).toBeDefined();
    expect(json.depGraph!.pkgManager?.name).toEqual('gomodules');

    const pkgs = json.depGraph!.pkgs;
    expect(pkgs.some(({ id }) => id.includes('github.com/gorilla/mux'))).toBe(
      true,
    );

    for (const { id, info } of pkgs) {
      expect(id).not.toMatch(/\s/);
      if (info?.name) {
        expect(info.name).not.toMatch(/\s/);
      }
    }
  });
});

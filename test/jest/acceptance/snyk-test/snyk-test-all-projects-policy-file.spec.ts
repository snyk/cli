/**
 * `snyk test --all-projects` over a workspace where projects carry their own
 * `.snyk` policy files.
 *
 * Legacy resolves the policy from the directory of each project's **own target
 * file**. There is no inheritance — not from the scan root, not from an
 * ancestor project — so a project with no `.snyk` of its own reports
 * `filesystemPolicy: false` however many policy files sit above it. This
 * asserts the unified test API flow resolves the same way (OSF-497).
 *
 * The layout is the input. With a single project in cwd, "the project's
 * `.snyk`", "cwd's `.snyk`" and "the scan root's `.snyk`" all resolve to one
 * path, so a flow that reads the wrong directory still looks correct —
 * snyk-test-local-policy-file.spec.ts cannot see this class of bug at all.
 *
 * `filesystemPolicy` and `policy` are read off each result document rather
 * than inferred from `ok`: they are the only fields that say *which* policy a
 * project was tested against, and they are computed from disk, so they hold
 * even though the fake server returns no findings to filter.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';
import { UNIFIED_TEST_API_FF } from './equivalenceHelpers';

jest.setTimeout(1000 * 60 * 5);

// The `reason` in every fixture `.snyk` names the directory it sits in, so a
// failure says which file was read rather than only that the wrong one was.
const ROOT_POLICY = 'policy at the scan root';
const PROJ_A_POLICY = 'policy in proj-a';
const PROJ_B_POLICY = 'policy in proj-b';

type ResultDocument = {
  displayTargetFile?: string;
  filesystemPolicy?: boolean;
  policy?: string;
};

/** Keys the result documents by project, so each row can be asserted by name. */
function byTargetFile(stdout: string): Record<string, ResultDocument> {
  const parsed = JSON.parse(stdout);
  const documents: ResultDocument[] = Array.isArray(parsed) ? parsed : [parsed];

  return Object.fromEntries(
    documents.map((doc) => [
      String(doc.displayTargetFile ?? '').replace(/\\/g, '/'),
      doc,
    ]),
  );
}

describe('`snyk test --all-projects` with per-project `.snyk` policy files', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    const fakeServerIp = getFirstIPv4Address();
    env = {
      ...process.env,
      SNYK_API: `http://${fakeServerIp}:${port}${baseApi}`,
      SNYK_HOST: `http://${fakeServerIp}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it('resolves each project against the `.snyk` in its own directory', async () => {
    const project = await createProjectFromFixture(
      'npm/all-projects-with-snyk-policies',
    );
    server.setFeatureFlag(UNIFIED_TEST_API_FF, true);

    // A clean HOME keeps GAF off any locally stored token that would
    // override SNYK_API.
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-all-projects-'));
    const { code, stdout, stderr } = await runSnykCLI(
      'test --all-projects --json',
      {
        cwd: project.path(),
        env: { ...env, HOME: home },
      },
    );

    // Exit 0 and 1 are both successful scans; only >= 2 is a failure. Carry
    // the output into the failure message — a scan that aborts says why on
    // stderr, and without it this reads as a bare "2 is not less than 2".
    if (code >= 2) {
      throw new Error(
        `scan failed with exit ${code}\n--- stderr ---\n${stderr}\n--- stdout ---\n${stdout}`,
      );
    }

    const results = byTargetFile(stdout);
    expect(Object.keys(results).sort()).toEqual([
      'proj-a/package-lock.json',
      'proj-b/package-lock.json',
      'proj-c/package-lock.json',
    ]);

    const projA = results['proj-a/package-lock.json'];
    const projB = results['proj-b/package-lock.json'];
    const projC = results['proj-c/package-lock.json'];

    // Each project that owns a `.snyk` is tested against that file...
    expect(projA.filesystemPolicy).toBe(true);
    expect(projA.policy).toContain(PROJ_A_POLICY);
    expect(projB.filesystemPolicy).toBe(true);
    expect(projB.policy).toContain(PROJ_B_POLICY);

    // ...and only against that file. Sibling projects do not share policies.
    expect(projA.policy).not.toContain(PROJ_B_POLICY);
    expect(projB.policy).not.toContain(PROJ_A_POLICY);

    // proj-c has no `.snyk` of its own. A root policy must not fill the gap:
    // `filesystemPolicy` is what separates "no policy was found" from "a
    // policy was found and matched nothing".
    expect(projC.filesystemPolicy).toBeFalsy();
    expect(projC.policy ?? '').not.toContain(ROOT_POLICY);

    // The scan root is not a project, so its `.snyk` is never applied. This is
    // the row that fails when the policy is resolved once from the scan root:
    // every project then reports the root's ignores as its own, suppressing
    // findings in projects that never opted into them.
    for (const [targetFile, doc] of Object.entries(results)) {
      expect(`${targetFile}: ${doc.policy ?? ''}`).not.toContain(ROOT_POLICY);
    }

    expect(stderr).not.toContain('Unhandled');
  });
});

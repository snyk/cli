/**
 * `snyk test` against a project whose `.snyk` policy file cannot be parsed.
 *
 * With the unified test API feature flag on, the os-flows extension reads the
 * policy file itself and reports an unparseable one through the Snyk error
 * catalog (SNYK-POLICY-0001) rather than letting it surface as an unspecified
 * error (SNYK-CLI-0000).
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

describe('`snyk test` with an unparseable `.snyk` policy file', () => {
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

  afterAll((done) => {
    server.close(() => done());
  });

  it('reports SNYK-POLICY-0001 and does not submit a test', async () => {
    const project = await createProjectFromFixture(
      'npm/with-malformed-snyk-file',
    );
    server.setCustomResponse(
      await project.readJSON('test-dep-graph-result.json'),
    );
    server.setFeatureFlag(UNIFIED_TEST_API_FF, true);

    // A clean HOME keeps GAF off any locally stored token that would
    // override SNYK_API.
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-policy-'));
    const { code, stdout, stderr } = await runSnykCLI('test', {
      cwd: project.path(),
      env: { ...env, HOME: home },
    });

    // The renderer word-wraps and pads the error box, so collapse whitespace
    // before matching on anything longer than a word.
    const output = (stdout + stderr).replace(/\s+/g, ' ');

    expect(output).toContain('SNYK-POLICY-0001');
    expect(output).toContain(
      'Unable to apply a policy with an invalid configuration',
    );
    // The message has to name the offending file...
    expect(output).toContain('.snyk');
    // ...and say what is actually wrong with it.
    expect(output).toContain(
      `dependency path 'reason' must map to a set of ignore settings`,
    );
    expect(output).toContain('check the indentation');
    // The bad policy must not be laundered into a generic failure.
    expect(output).not.toContain('SNYK-CLI-0000');
    // Nor may the message spell out the Go types behind the parser.
    expect(output).not.toContain('localpolicy.');
    expect(output).not.toContain('struct {');
    expect(code).not.toBe(0);

    const submissions = server
      .getRequests()
      .filter((req) => req.method === 'POST' && /\/tests$/.test(req.url));
    expect(submissions).toHaveLength(0);
  });
});

/**
 * Equivalence acceptance suite for the unified test API rollout.
 *
 * For each fixture we run `snyk test` twice:
 *   FF off — TS CLI posts dep graphs to /test-dep-graph (legacy path)
 *   FF on  — Go binary's os-flows extension posts to /rest/orgs/:orgId/tests
 *
 * The flag under test is `internal_snyk_cli_use_unified_test_api_for_os_cli_test`.
 * FF off → TS CLI posts dep graphs inline to /v1/test-dep-graph (legacy path).
 * FF on  → Go binary's os-flows extension resolves dep graphs via the plugin
 *           orchestrator and posts to /rest/orgs/:orgId/tests.
 *
 * Starter corpus. Expand per resolveDepgraphs-rollout-plan.md.
 */

import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getAvailableServerPort } from '../../util/getServerPort';
import { assertEquivalent, runBothFlows } from './equivalenceHelpers';

jest.setTimeout(1000 * 60 * 5);

describe('snyk test — unified test API equivalence (FF off vs on)', () => {
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

  afterAll((done) => {
    server.close(() => done());
  });

  type Fixture = {
    name: string;
    args: string;
    expectNoSubmissions?: boolean;
  };

  const fixtures: Fixture[] = [
    { name: 'npm-package', args: 'test' },
    { name: 'maven-app', args: 'test' },
    { name: 'mono-repo-project', args: 'test --all-projects' },
    {
      name: 'no-supported-target-files',
      args: 'test',
      expectNoSubmissions: true,
    },
  ];

  describe.each(fixtures)(
    'fixture: $name ($args)',
    ({ name, args, expectNoSubmissions }) => {
      test('FF off vs on produces equivalent dep graphs and exit code', async () => {
        const project = await createProjectFromWorkspace(name);

        const result = await runBothFlows(project.path(), args, server, env);
        const diff = assertEquivalent(result, { expectNoSubmissions });

        if (!diff.ok) {
          throw new Error(
            `Equivalence failed for ${name} (${args}): ${diff.reason}\n` +
              `detail=${JSON.stringify(diff.detail, null, 2)}`,
          );
        }
      });
    },
  );
});

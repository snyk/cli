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
 * Phase 1 of the rollout: breadth across every ecosystem that resolves through
 * the legacy-CLI fallback. The native resolver flags (cargo, pnpm, gradle, …)
 * stay OFF here, so BOTH runs resolve via the same legacy CLI and only the
 * submission endpoint differs — that endpoint/serialization parity is what this
 * phase proves. Native-resolver parity (gradle, pnpm) and exit-1/error parity
 * arrive in later phases.
 *
 * Fixtures that need an external build tool to resolve (go, sbt, swift, …) are
 * tagged with `requiresCmd` and skip when that tool is absent rather than
 * failing "inconclusive". Pure lockfile ecosystems (yarn, ruby, composer,
 * poetry, …) need no tool beyond what the harness already has.
 *
 * Note: pip/pipenv and hex/mix are deliberately excluded — their snyk plugins
 * resolve by introspecting an *installed* environment (site-packages / fetched
 * mix deps), so they need an install step and can't resolve from a clean
 * checkout. Python is covered via Poetry, which resolves offline from its lock.
 */

import { execFileSync } from 'child_process';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { getServerPort } from '../../util/getServerPort';
import { assertEquivalent, runBothFlows } from './equivalenceHelpers';

jest.setTimeout(1000 * 60 * 3);

/** True when `cmd` resolves on PATH — used to skip fixtures whose toolchain is absent. */
function commandAvailable(cmd: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

describe('snyk test — unified test API equivalence (FF off vs on)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => done());
  });

  afterAll((done) => {
    server.close(() => done());
  });

  type Fixture = {
    name: string;
    args: string;
    expectNoSubmissions?: boolean;
    /** Expected to be rejected by both flows (e.g. out-of-sync lockfile). */
    expectError?: boolean;
    /** Binary that must be on PATH for the legacy CLI to resolve this fixture.
     *  Omitted for lockfile-only ecosystems that need no external build tool. */
    requiresCmd?: string;
  };

  const fixtures: Fixture[] = [
    // --- Starter corpus (unchanged) ---
    { name: 'npm-package', args: 'test' },
    { name: 'maven-app', args: 'test' },
    { name: 'mono-repo-project', args: 'test --all-projects' },
    {
      name: 'no-supported-target-files',
      args: 'test',
      expectNoSubmissions: true,
    },

    // --- Phase 1: breadth via the legacy fallback ---
    // JavaScript (yarn) — resolved from yarn.lock; no tool beyond node.
    { name: 'yarn-package', args: 'test' },
    { name: 'yarn-workspaces', args: 'test --all-projects' },
    // Ruby — resolved from Gemfile.lock.
    { name: 'ruby-app', args: 'test' },
    // PHP (Composer) — resolved from composer.lock.
    { name: 'composer-app', args: 'test' },
    // CocoaPods — resolved from Podfile.lock.
    { name: 'cocoapods-app', args: 'test' },
    // Swift (SwiftPM) — the plugin shells out to `swift package show-dependencies`,
    // so it needs the swift toolchain (gated) and the deps on disk. The fixture
    // depends on a sibling package by path, keeping resolution network-free.
    { name: 'swift-local-dep', args: 'test', requiresCmd: 'swift' },
    // Go modules — needs the go toolchain.
    { name: 'golang-gomodules', args: 'test', requiresCmd: 'go' },
    // Python (Poetry) — resolved from poetry.lock; no tool beyond node.
    // (pip/pipenv are intentionally NOT used here: their snyk plugins resolve by
    // introspecting *installed* site-packages, so they require a pip/pipenv
    // install step and can't resolve from a clean checkout the way a lockfile can.)
    { name: 'poetry-app', args: 'test' },
    // .NET (NuGet) — resolved from project.assets.json; no tool beyond node.
    { name: 'nuget-app-2', args: 'test' },
    // Scala (sbt) — needs sbt.
    { name: 'sbt-app', args: 'test', requiresCmd: 'sbt' },

    // --- Phase 2: option parity (same flag applied to BOTH flows) ---
    // Each option is passed to legacy and unified alike; the resolved graph and
    // project metadata must still match. Clean projects, so exit code stays 0.
    { name: 'npm-package', args: 'test --dev' },
    { name: 'npm-package', args: 'test --file=package.json' },
    {
      name: 'npm-package-pruneable',
      args: 'test --prune-repeated-subdependencies',
    },

    // --- Phase 2: partial-failure parity under --all-projects ---
    // monorepo-bad-project mixes resolvable and unresolvable projects. This is
    // the exact scenario the os-flows change targeted ("tolerate per-project
    // resolution failures in the --all-projects orchestrator path"): both flows
    // should resolve the good projects, skip the bad one, and agree on the
    // submitted-project count and exit code.
    { name: 'monorepo-bad-project', args: 'test --all-projects' },

    // --- Phase 2: error parity (both flows must REJECT the bad input) ---
    // Exit-code values legitimately differ (TS CLI 3 vs os-flows 2), so these
    // assert the tolerance invariant "both fail" rather than equal codes.
    { name: 'npm-out-of-sync', args: 'test', expectError: true },
    { name: 'yarn-out-of-sync', args: 'test', expectError: true },
  ];

  describe.each(fixtures)(
    'fixture: $name ($args)',
    ({ name, args, expectNoSubmissions, expectError, requiresCmd }) => {
      const runnable = !requiresCmd || commandAvailable(requiresCmd);
      (runnable ? test : test.skip)(
        'FF off vs on produces equivalent dep graphs and exit code',
        async () => {
          const project = await createProjectFromWorkspace(name);

          const result = await runBothFlows(project.path(), args, server, env);
          const diff = assertEquivalent(result, {
            expectNoSubmissions,
            expectError,
          });

          if (!diff.ok) {
            throw new Error(
              `Equivalence failed for ${name} (${args}): ${diff.reason}\n` +
                `detail=${JSON.stringify(diff.detail, null, 2)}`,
            );
          }
        },
      );
    },
  );
});

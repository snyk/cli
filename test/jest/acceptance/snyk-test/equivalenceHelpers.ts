/**
 * Helpers for comparing snyk test behavior with the
 * `internal_snyk_cli_use_unified_test_api_for_os_cli_test` feature flag off vs on.
 *
 * FF off  → TS CLI posts dep graphs inline to /v1/test-dep-graph
 * FF on   → Go binary os-flows extension resolves dep graphs via the plugin
 *            orchestrator, uploads them as files, then creates a test via
 *            POST /rest/orgs/:orgId/tests referencing the revision ID.
 *            The dep graph is NOT inline in the test body.
 *
 * Equivalence is verified by comparing the JSON stdout from both flows:
 * project count, display target files, package managers, dependency counts,
 * project names, findings, and exit codes must all match.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';
import { RunCommandOptions } from '../../util/runCommand';

export const UNIFIED_TEST_API_FF =
  'internal_snyk_cli_use_unified_test_api_for_os_cli_test';

// Fields compared per-project between legacy and unified output.
type ProjectResult = {
  displayTargetFile: string;
  targetFile: string; // normalised: absent and "" both become ""
  packageManager: string;
  dependencyCount: number;
  projectName: string;
  ok: boolean;
  vulnerabilities: unknown[];
};

export type FlowCapture = {
  code: number;
  stdout: string;
  stderr: string;
  /** Number of test submissions made to the backend. */
  submissionCount: number;
  /** Parsed and normalised per-project results from JSON stdout. */
  projects: ProjectResult[];
};

export type EquivalenceResult = {
  legacy: FlowCapture;
  unified: FlowCapture;
};

/**
 * Runs `snyk test` twice against the same fakeServer: once with the unified
 * test API FF off (legacy TS path, posts to /test-dep-graph) and once with
 * the FF on (os-flows path, posts to /rest/orgs/:orgId/tests). The server is
 * restored between runs so each capture sees only its own requests.
 *
 * Both runs use a clean HOME directory so the Go binary's GAF reads from a
 * fresh configstore with no locally-stored OAuth token that would override SNYK_API.
 */
export async function runBothFlows(
  cwd: string,
  argsString: string,
  server: FakeServer,
  env: Record<string, string | undefined>,
  runOptions: RunCommandOptions = {},
  /**
   * Extra feature flags to enable ONLY in the unified (FF-on) run — e.g. a
   * native resolver gate like 'internal_new_gradle_resolver'. The legacy run
   * never sees these, so the comparison becomes "native resolver vs legacy
   * CLI". Empty (the default) keeps both runs on the legacy resolver, which is
   * the Phase 1 endpoint-parity comparison.
   */
  unifiedFlags: string[] = [],
): Promise<EquivalenceResult> {
  const argsWithJson = argsString.includes('--json')
    ? argsString
    : `${argsString} --json`;

  const legacyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-legacy-'));
  const unifiedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-unified-'));

  server.restore();
  server.setFeatureFlag(UNIFIED_TEST_API_FF, false);
  const legacyRun = await runSnykCLI(argsWithJson, {
    ...runOptions,
    cwd,
    env: { ...env, HOME: legacyHome },
  });
  const legacy = captureFlow(legacyRun, server, 'legacy');

  server.restore();
  server.setFeatureFlag(UNIFIED_TEST_API_FF, true);
  for (const flag of unifiedFlags) {
    server.setFeatureFlag(flag, true);
  }
  const unifiedRun = await runSnykCLI(argsWithJson, {
    ...runOptions,
    cwd,
    env: { ...env, HOME: unifiedHome },
  });
  const unified = captureFlow(unifiedRun, server, 'unified');
  server.restore();

  return { legacy, unified };
}

function captureFlow(
  run: { code: number; stdout: string; stderr: string },
  server: FakeServer,
  mode: 'legacy' | 'unified',
): FlowCapture {
  const requests = server.getRequests();

  const submissionCount =
    mode === 'legacy'
      ? requests.filter(
          (r) =>
            r.method === 'POST' &&
            typeof r.url === 'string' &&
            r.url.includes('/test-dep-graph'),
        ).length
      : requests.filter(
          (r) =>
            r.method === 'POST' &&
            typeof r.path === 'string' &&
            /^\/rest\/orgs\/[^/]+\/tests$/.test(r.path),
        ).length;

  return {
    code: run.code,
    stdout: run.stdout,
    stderr: run.stderr,
    submissionCount,
    projects: parseProjects(run.stdout),
  };
}

function parseProjects(stdout: string): ProjectResult[] {
  try {
    const raw = JSON.parse(stdout);
    const items: unknown[] = Array.isArray(raw) ? raw : [raw];
    return items
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .map((item) => ({
        displayTargetFile: String(item.displayTargetFile ?? ''),
        targetFile: String(item.targetFile ?? ''), // absent and "" both become ""
        packageManager: String(item.packageManager ?? ''),
        dependencyCount: Number(item.dependencyCount ?? 0),
        projectName: String(item.projectName ?? ''),
        ok: Boolean(item.ok),
        vulnerabilities: Array.isArray(item.vulnerabilities)
          ? item.vulnerabilities
          : [],
      }))
      .sort((a, b) => a.displayTargetFile.localeCompare(b.displayTargetFile));
  } catch (e) {
    console.error('[equivalenceHelpers] failed to parse stdout as JSON:', e);
    return [];
  }
}

export type EquivalenceDiff = {
  ok: boolean;
  reason?: string;
  detail?: unknown;
};

export type AssertOptions = {
  /** Set true for fixtures that legitimately produce no submissions
   *  (e.g. "no supported target files"). */
  expectNoSubmissions?: boolean;
  /** Set true for fixtures expected to be REJECTED by both flows (e.g. an
   *  out-of-sync lockfile). The two flows have intentional exit-code
   *  differences for failures (TS CLI exits 3, os-flows exits 2), so this
   *  asserts the tolerance invariant "both fail" rather than equal codes. */
  expectError?: boolean;
};

export function assertEquivalent(
  result: EquivalenceResult,
  options: AssertOptions = {},
): EquivalenceDiff {
  const { legacy, unified } = result;

  // Error-parity mode: the fixture should be rejected by BOTH flows. Exit-code
  // values legitimately differ between the TS CLI and os-flows, so we assert
  // only the invariant that neither flow reported success.
  if (options.expectError) {
    if (legacy.code !== 0 && unified.code !== 0) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `expected both flows to fail: legacy=${legacy.code} unified=${unified.code}`,
      detail: {
        legacyStderr: legacy.stderr,
        unifiedStderr: unified.stderr,
      },
    };
  }

  const bothEmpty =
    legacy.submissionCount === 0 && unified.submissionCount === 0;

  if (options.expectNoSubmissions && bothEmpty) {
    // Both paths produced nothing to scan — that's the expected outcome.
    // Exit codes legitimately differ (TS CLI exits 3, os-flows exits 2) so
    // we don't compare them here.
    return { ok: true };
  }

  if (!options.expectNoSubmissions && bothEmpty) {
    return {
      ok: false,
      reason: 'inconclusive: both runs produced zero submissions',
      detail: {
        legacyExit: legacy.code,
        unifiedExit: unified.code,
        legacyStderr: legacy.stderr,
        unifiedStderr: unified.stderr,
      },
    };
  }

  if (legacy.code !== unified.code) {
    return {
      ok: false,
      reason: `exit code mismatch: legacy=${legacy.code} unified=${unified.code}`,
      detail: { legacyStderr: legacy.stderr, unifiedStderr: unified.stderr },
    };
  }

  if (legacy.submissionCount !== unified.submissionCount) {
    return {
      ok: false,
      reason: `project count mismatch: legacy=${legacy.submissionCount} unified=${unified.submissionCount}`,
      detail: {
        legacyTargets: legacy.projects.map((p) => p.displayTargetFile),
        unifiedTargets: unified.projects.map((p) => p.displayTargetFile),
      },
    };
  }

  // Compare per-project fields. Both are sorted by displayTargetFile.
  for (let i = 0; i < legacy.projects.length; i++) {
    const leg = legacy.projects[i];
    const uni = unified.projects[i];

    const fields: (keyof ProjectResult)[] = [
      'displayTargetFile',
      'targetFile',
      'packageManager',
      'dependencyCount',
      'projectName',
      'ok',
    ];

    for (const field of fields) {
      const legVal = JSON.stringify(leg[field]);
      const uniVal = JSON.stringify(uni[field]);
      if (legVal !== uniVal) {
        return {
          ok: false,
          reason: `project[${i}] field "${field}" mismatch`,
          detail: {
            legacy: leg[field],
            unified: uni[field],
            project: leg.displayTargetFile,
          },
        };
      }
    }

    if (leg.vulnerabilities.length !== uni.vulnerabilities.length) {
      return {
        ok: false,
        reason: `project[${i}] vulnerability count mismatch`,
        detail: {
          legacy: leg.vulnerabilities.length,
          unified: uni.vulnerabilities.length,
          project: leg.displayTargetFile,
        },
      };
    }
  }

  return { ok: true };
}

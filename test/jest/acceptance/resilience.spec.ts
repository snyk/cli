import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';
import { Snyk } from '@snyk/error-catalog-nodejs-public';
import { EXIT_CODES } from '../../../src/cli/exit-codes';
import { getCliConfig, restoreCliConfig } from '../../acceptance/config-helper';

jest.setTimeout(1000 * 60);

const TIMEOUT_SECS = 5;
const GRACE_PERIOD_SECS = 5;
const SERVER_DELAY_MS = 10000;
const FAKE_ORG = '11111111-1111-1111-1111-111111111111';

// Commands that should behave consistently across all fault scenarios
const COMMANDS_UNDER_TEST = [
  'test',
  'code test',
  'container test scratch',
  'container monitor scratch',
  'iac test',
  'secrets test',
  'monitor',
  'whoami',
  'auth 11111111-2222-3333-4444-555555555555',
  'sbom --org=11111111-1111-1111-1111-111111111111 --format=cyclonedx1.4+json',
  'container sbom scratch --format=cyclonedx1.4+json',
  'sbom test --experimental --file=package.json',
  'aibom test --experimental',
];

interface ScenarioContext {
  server: ReturnType<typeof fakeServer>;
  savedConfig?: Record<string, string>;
}

interface TestResult {
  code: number;
  stdout: string;
  duration: number;
}

interface AssertionContext {
  server: ReturnType<typeof fakeServer>;
  result: TestResult;
}

interface ResilienceScenario {
  name: string;
  description: string;
  setup: (ctx: ScenarioContext) => void | Promise<void>;
  teardown?: (ctx: ScenarioContext) => void | Promise<void>;
  expectedExitCode: number;
  expectedErrorCode: string;
  assert?: (ctx: AssertionContext) => void; // Additional scenario-specific assertions
  envOverrides?: Record<string, string>;
  skip?: string[]; // Commands to skip for this scenario (not yet consistent)
}

describe('TEST_SNYK_IGNORE_LIST → testPathIgnorePatterns', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createJestConfig } = require('../../createJestConfig') as {
    createJestConfig: (config?: object) => {
      testPathIgnorePatterns: string[];
    };
  };
  let previousIgnoreList: string | undefined;

  beforeEach(() => {
    previousIgnoreList = process.env.TEST_SNYK_IGNORE_LIST;
  });

  afterEach(() => {
    if (previousIgnoreList === undefined) {
      delete process.env.TEST_SNYK_IGNORE_LIST;
    } else {
      process.env.TEST_SNYK_IGNORE_LIST = previousIgnoreList;
    }
  });

  it('when unset or empty, does not add fragments from TEST_SNYK_IGNORE_LIST', () => {
    for (const value of [undefined as string | undefined, '']) {
      if (value === undefined) {
        delete process.env.TEST_SNYK_IGNORE_LIST;
      } else {
        process.env.TEST_SNYK_IGNORE_LIST = value;
      }
      const ignorePathPatterns = createJestConfig({}).testPathIgnorePatterns;
      expect(ignorePathPatterns).toContain('/node_modules/');
      expect(ignorePathPatterns).not.toContain('happy-path-one');
    }
  });

  it('single comma-separated pattern is merged', () => {
    process.env.TEST_SNYK_IGNORE_LIST = 'happy-path-one';
    expect(createJestConfig({}).testPathIgnorePatterns).toContain(
      'happy-path-one',
    );
  });

  it('two comma-separated patterns are merged', () => {
    process.env.TEST_SNYK_IGNORE_LIST = 'happy-path-a, happy-path-b';
    const ignorePathPatterns = createJestConfig({}).testPathIgnorePatterns;
    expect(ignorePathPatterns).toContain('happy-path-a');
    expect(ignorePathPatterns).toContain('happy-path-b');
  });
});

const RESILIENCE_SCENARIOS: ResilienceScenario[] = [
  // Scenario 1
  {
    name: 'maintenance-window',
    description: 'Backend in maintenance mode (503 with error catalog)',
    setup: ({ server }) => {
      const maintenanceErrorRes = {
        jsonapi: { version: '1.0' },
        errors: [new Snyk.MaintenanceWindowError('').toJsonApiErrorObject()],
        description: 'Maintenance window',
      };
      server.setGlobalResponse(
        maintenanceErrorRes,
        parseInt(maintenanceErrorRes.errors[0].status),
      );
    },
    expectedExitCode: EXIT_CODES.EX_TEMPFAIL,
    expectedErrorCode: 'SNYK-0099',
    assert: ({ server }) => {
      // Verify no retries (fail fast for maintenance)
      // Each snyk-request-id should appear only once - duplicates indicate retries
      const requests = server.getRequests();
      const requestIdCounts = new Map<string, number>();
      for (const req of requests) {
        const header = req.headers?.['snyk-request-id'];
        const requestId = Array.isArray(header) ? header[0] : header;
        if (requestId) {
          requestIdCounts.set(
            requestId,
            (requestIdCounts.get(requestId) ?? 0) + 1,
          );
        }
      }
      for (const count of requestIdCounts.values()) {
        expect(count).toBe(1);
      }
    },
    envOverrides: {
      // Enable retries to verify they are NOT used
      SNYK_MAX_ATTEMPTS: '10',
    },
  },

  // Scenario 2
  {
    name: 'timeout',
    description: 'CLI times out before command finishes',
    setup: ({ server }) => {
      server.setResponseDelay(SERVER_DELAY_MS);
    },
    expectedExitCode: EXIT_CODES.EX_UNAVAILABLE,
    expectedErrorCode: 'SNYK-CLI-0026',
    assert: ({ result, server }) => {
      // Verify timeout occurred within expected bounds
      expect(result.duration).toBeGreaterThanOrEqual(TIMEOUT_SECS * 1000);
      expect(result.duration).toBeLessThan(
        (TIMEOUT_SECS + GRACE_PERIOD_SECS) * 1000,
      );

      const requests = server.getRequests();
      const instrumentationRequest = requests.find((r) =>
        r.url?.includes(`/api/hidden/orgs/${FAKE_ORG}/analytics`),
      );
      //eslint-disable-next-line jest/no-standalone-expect
      expect(instrumentationRequest).toBeDefined();
    },
    envOverrides: {
      SNYK_TIMEOUT_SECS: String(TIMEOUT_SECS),
    },
    skip: ['container sbom scratch'],
  },

  // Scenario 3
  {
    name: 'unauthorized-401',
    description: 'Backend returns 401 Unauthorized',
    setup: ({ server }) => {
      server.setGlobalResponse(
        {
          jsonapi: { version: '1.0' },
          errors: [new Snyk.UnauthorisedError('').toJsonApiErrorObject()],
        },
        401,
      );
    },
    expectedExitCode: EXIT_CODES.ERROR,
    expectedErrorCode: 'SNYK-0005',
    skip: [
      'container sbom scratch',
      'container test scratch',
      'container monitor scratch',
      'iac test',
      'secrets test',
      'auth', // auth doesn't need to
    ],
  },

  // Scenario 4
  {
    name: 'mid-execution-maintenance',
    description: 'Backend enters maintenance after initial successful requests',
    setup: ({ server }) => {
      const maintenanceErrorRes = {
        jsonapi: { version: '1.0' },
        errors: [new Snyk.MaintenanceWindowError('').toJsonApiErrorObject()],
        description: 'Maintenance window',
      };

      // First request succeeds, subsequent requests hit maintenance
      server.setNextStatusCode(200);
      server.setNextStatusCode(200);
      server.setNextStatusCode(200);
      server.setNextStatusCode(200);
      server.setGlobalResponse(
        maintenanceErrorRes,
        parseInt(maintenanceErrorRes.errors[0].status),
      );
    },
    expectedExitCode: EXIT_CODES.EX_TEMPFAIL,
    expectedErrorCode: 'SNYK-0099',
    skip: [
      'whoami', // Single-request commands won't hit the failure
      'auth', // Single-request commands won't hit the failure
      'container monitor scratch',
    ],
  },
];

function shouldSkip(scenario: ResilienceScenario, command: string): boolean {
  if (!scenario.skip) return false;
  return scenario.skip.some((skip) => command.startsWith(skip));
}

describe('Resilience - Consistent CLI Behavior', () => {
  let server: ReturnType<typeof fakeServer>;
  let baseEnv: Record<string, string>;

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';

    baseEnv = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_CFG_ORG: FAKE_ORG,
    };

    server = fakeServer(baseApi, baseEnv.SNYK_TOKEN);
    server.setFeatureFlag('isSecretsEnabled', true);
    await server.listenPromise(port);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  describe.each(RESILIENCE_SCENARIOS)(
    '$name: $description',
    (scenario: ResilienceScenario) => {
      const commandsToRun = COMMANDS_UNDER_TEST.filter(
        (cmd) => !shouldSkip(scenario, cmd),
      );
      const commandsToSkip = COMMANDS_UNDER_TEST.filter((cmd) =>
        shouldSkip(scenario, cmd),
      );

      if (commandsToSkip.length > 0) {
        it.skip.each(commandsToSkip)('"%s" (not yet consistent)', () => {});
      }

      it.each(commandsToRun)('"%s"', async (command) => {
        const ctx: ScenarioContext = { server };
        const requiresConfigRestore = command.startsWith('auth');

        try {
          if (requiresConfigRestore) {
            ctx.savedConfig = await getCliConfig();
          }

          await scenario.setup(ctx);
          const env = { ...baseEnv, ...scenario.envOverrides };

          const startTime = Date.now();
          const { code, stdout } = await runSnykCLI(command, { env });
          const duration = Date.now() - startTime;

          // Common assertions
          expect(code).toEqual(scenario.expectedExitCode);
          expect(stdout).toContain(scenario.expectedErrorCode);

          // Scenario-specific assertions
          if (scenario.assert) {
            scenario.assert({
              server,
              result: { code, stdout, duration },
            });
          }
        } finally {
          server.restore();
          if (scenario.teardown) {
            await scenario.teardown(ctx);
          }
          if (requiresConfigRestore && ctx.savedConfig) {
            await restoreCliConfig(ctx.savedConfig);
          }
        }
      });
    },
  );
});

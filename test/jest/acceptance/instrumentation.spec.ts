import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';
import { matchers } from 'jest-json-schema';

expect.extend(matchers);

const INSTRUMENTATION_SCHEMA = require('../../schemas/instrumentationSchema.json');

jest.setTimeout(1000 * 30);

describe('instrumentation module', () => {
  let server;
  let env: Record<string, string>;
  const fixtureName = 'npm-package';
  const baseApi = '/api/v1';
  const port = getServerPort(process);
  const snykOrg = '11111111-2222-3333-4444-555555555555';
  const defaultEnvVars = {
    SNYK_API: 'http://localhost:' + port + baseApi,
    SNYK_HOST: 'http://localhost:' + port,
    SNYK_TOKEN: '123456789',
    SNYK_CFG_ORG: snykOrg,
  };

  beforeAll((done) => {
    env = {
      ...process.env,
      ...defaultEnvVars,
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  describe('CLI support', () => {
    it('sends instrumentation data for the CLI', async () => {
      const project = await createProjectFromWorkspace(fixtureName);
      const { code } = await runSnykCLI('test --debug', {
        cwd: project.path(),
        env,
      });

      expect(code).toBe(0);

      // find the instrumentation request
      const instrumentationRequest = server
        .getRequests()
        .filter((value) =>
          (value.url as string).includes(
            `/api/hidden/orgs/${snykOrg}/analytics`,
          ),
        )
        .pop();

      expect(instrumentationRequest?.body).toMatchSchema(
        INSTRUMENTATION_SCHEMA,
      );
    });

    it('sends instrumentation data even if disable analytics is set via SNYK_DISABLE_ANALYTICS', async () => {
      const project = await createProjectFromWorkspace(fixtureName);
      const { code } = await runSnykCLI(`test --debug`, {
        env: {
          cwd: project.path(),
          ...env,
          SNYK_DISABLE_ANALYTICS: '1',
        },
      });
      expect(code).toBe(0);

      // v1 analytics should not be sent
      const v1AnalyticsRequest = server
        .getRequests()
        .filter((value) => value.url == '/api/v1/analytics/cli')
        .pop();

      // but instrumentation should
      const instrumentationRequest = server
        .getRequests()
        .filter((value) =>
          (value.url as string).includes(
            `/api/hidden/orgs/${snykOrg}/analytics`,
          ),
        )
        .pop();

      expect(v1AnalyticsRequest).toBeUndefined();
      expect(instrumentationRequest?.body).toMatchSchema(
        INSTRUMENTATION_SCHEMA,
      );
    });
  });

  describe.each(['VS_CODE', 'JETBRAINS_IDE', 'VISUAL_STUDIO', 'ECLIPSE'])(
    'IDE support',
    (ide) => {
      describe('analytics command not called from IDE', () => {
        it(`does not send instrumentation data for the ${ide} IDE`, async () => {
          const project = await createProjectFromWorkspace(fixtureName);
          const { code } = await runSnykCLI('test --debug', {
            cwd: project.path(),
            env: {
              ...process.env,
              ...defaultEnvVars,
              SNYK_INTEGRATION_NAME: ide,
            },
          });

          expect(code).toBe(0);

          const instrumentationRequest = server
            .getRequests()
            .filter((value) =>
              (value.url as string).includes(
                `/api/hidden/orgs/${snykOrg}/analytics`,
              ),
            )
            .pop();

          // we should not expect to find any requests to the analytics API instrumentation endpoint
          expect(instrumentationRequest).toBeUndefined();
        });
      });

      describe('analytics command called from IDE', () => {
        // we need to remove all whitepace here due to how we split the CLI args in runSnykCLI()
        const v1Data =
          '{"data":{"type":"analytics","attributes":{"path":"/path/to/test","device_id":"unique-uuid","application":"snyk-cli","application_version":"1.1233.0","os":"macOS","arch":"ARM64","integration_name":"IntelliJ","integration_version":"2.5.5","integration_environment":"Pycharm","integration_environment_version":"2023.1","event_type":"Scandone","status":"Succeeded","scan_type":"SnykOpenSource","unique_issue_count":{"critical":15,"high":10,"medium":1,"low":2},"duration_ms":"1000","timestamp_finished":"2023-09-01T12:00:00Z"}}}';

        it(`sends instrumentation data for the ${ide} IDE`, async () => {
          const project = await createProjectFromWorkspace(fixtureName);
          const { code } = await runSnykCLI(
            `analytics report --experimental --debug --inputData ${v1Data}`,
            {
              cwd: project.path(),
              env: {
                ...process.env,
                ...defaultEnvVars,
                SNYK_INTEGRATION_NAME: ide,
              },
            },
          );

          expect(code).toBe(0);

          // find the intrumentation request
          const intrumentationRequest = server
            .getRequests()
            .filter((value) =>
              (value.url as string).includes(
                `/api/hidden/orgs/${snykOrg}/analytics`,
              ),
            )
            .pop();

          expect(intrumentationRequest?.body).toMatchSchema(
            INSTRUMENTATION_SCHEMA,
          );
        });
      });
    },
  );
});

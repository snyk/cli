import { getStandardData } from '../../../../../src/lib/analytics/getStandardData';
import { getCommandVersion } from '../../../../../src/lib/analytics/sources';
import { ArgsOptions } from '../../../../../src/cli/args';

function argsFrom(args: { [key: string]: string }): ArgsOptions[] {
  const fullArgs = ([
    {
      ...args,
    },
  ] as any) as ArgsOptions[];
  return fullArgs;
}

describe('getStandardData returns object', () => {
  it('contains all the required fields', async () => {
    const args = argsFrom({});
    const standardData = await getStandardData(args);

    expect(standardData).toMatchObject({
      os: expect.any(String),
      version: '1.0.0-monorepo',
      id: expect.any(String),
      ci: expect.any(Boolean),
      environment: {
        npmVersion: await getCommandVersion('npm'),
      },
      // prettier-ignore
      metrics: {
        'network_time': {
          type: 'timer',
          values: [],
          total: expect.any(Number),
        },
        'cpu_time': {
          type: 'synthetic',
          values: expect.any(Array),
          total: expect.any(Number),
        },
      },
      nodeVersion: expect.any(String),
      standalone: false,
      durationMs: expect.any(Number),
      integrationName: expect.any(String),
      integrationVersion: expect.any(String),
      integrationEnvironment: expect.any(String),
      integrationEnvironmentVersion: expect.any(String),
    });
  });

  it('contains all the required fields with integration info', async () => {
    const args = argsFrom({
      integrationName: 'JENKINS',
      integrationVersion: '1.2.3',
      integrationEnvironment: 'TEST_INTEGRATION_ENV',
      integrationEnvironmentVersion: '2020.2',
    });

    const standardData = await getStandardData(args);
    expect(standardData).toMatchObject({
      os: expect.any(String),
      version: '1.0.0-monorepo',
      id: expect.any(String),
      ci: expect.any(Boolean),
      environment: {
        npmVersion: await getCommandVersion('npm'),
      },
      // prettier-ignore
      metrics: {
        'network_time': {
          type: 'timer',
          values: [],
          total: expect.any(Number),
        },
        'cpu_time': {
          type: 'synthetic',
          values: expect.any(Array),
          total: expect.any(Number),
        },
      },
      nodeVersion: expect.any(String),
      standalone: false,
      durationMs: expect.any(Number),
      integrationName: 'JENKINS',
      integrationVersion: '1.2.3',
      integrationEnvironment: 'TEST_INTEGRATION_ENV',
      integrationEnvironmentVersion: '2020.2',
    });
  });
});

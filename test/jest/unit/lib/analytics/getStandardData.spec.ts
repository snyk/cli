import { getStandardData } from '../../../../../src/lib/analytics/getStandardData';
import { argsFrom } from './utils';

describe('getStandardData returns object', () => {
  it('contains all the required fields', async () => {
    const args = argsFrom({});
    const standardData = await getStandardData(args);

    expect(standardData).toMatchObject({
      os: expect.any(String),
      osPlatform: expect.any(String),
      osRelease: expect.any(String),
      osArch: expect.any(String),
      version: '1.0.0-monorepo',
      id: expect.any(String),
      ci: expect.any(Boolean),
      metrics: {
        network_time: {
          type: 'timer',
          values: [],
          total: expect.any(Number),
        },
        cpu_time: {
          type: 'synthetic',
          values: expect.any(Array),
          total: expect.any(Number),
        },
      },
      nodeVersion: expect.any(String),
      standalone: expect.any(Boolean),
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
      osPlatform: expect.any(String),
      osRelease: expect.any(String),
      osArch: expect.any(String),
      version: '1.0.0-monorepo',
      id: expect.any(String),
      ci: expect.any(Boolean),
      metrics: {
        network_time: {
          type: 'timer',
          values: [],
          total: expect.any(Number),
        },
        cpu_time: {
          type: 'synthetic',
          values: expect.any(Array),
          total: expect.any(Number),
        },
      },
      nodeVersion: expect.any(String),
      standalone: expect.any(Boolean),
      durationMs: expect.any(Number),
      integrationName: 'JENKINS',
      integrationVersion: '1.2.3',
      integrationEnvironment: 'TEST_INTEGRATION_ENV',
      integrationEnvironmentVersion: '2020.2',
    });
  });
});

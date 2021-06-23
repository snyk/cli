const analytics = require('../../../src/lib/analytics');

const testTimeout = 50000;
describe('Analytics basic testing', () => {
  it(
    'Has all analytics arguments',
    async () => {
      analytics.add('foo', 'bar');
      const data = { args: [], command: '__test__' };
      const res = await analytics.addDataAndSend(data);
      if (!res) {
        throw 'analytics creation failed!';
      }
      const keys = Object.keys(data).sort();
      expect(keys).toEqual(
        [
          'command',
          'os',
          'version',
          'id',
          'ci',
          'environment',
          'metadata',
          'metrics',
          'args',
          'nodeVersion',
          'standalone',
          'durationMs',
          'integrationName',
          'integrationVersion',
          'integrationEnvironment',
          'integrationEnvironmentVersion',
        ].sort(),
      );
    },
    testTimeout,
  );

  it(
    'Has all analytics arguments when org is specified',
    async () => {
      analytics.add('foo', 'bar');
      const data = { args: [], command: '__test__', org: '__snyk__' };
      const res = await analytics.addDataAndSend(data);
      if (!res) {
        throw 'analytics creation failed!';
      }
      const keys = Object.keys(data).sort();
      expect(keys).toEqual(
        [
          'command',
          'os',
          'version',
          'id',
          'ci',
          'environment',
          'metadata',
          'metrics',
          'args',
          'nodeVersion',
          'standalone',
          'durationMs',
          'org',
          'integrationName',
          'integrationVersion',
          'integrationEnvironment',
          'integrationEnvironmentVersion',
        ].sort(),
      );
    },
    testTimeout,
  );

  it(
    'Has all analytics arguments when args are given',
    async () => {
      analytics.add('foo', 'bar');
      const data = {
        args: [{ integrationName: 'JENKINS', integrationVersion: '1.2.3' }],
        command: '__test__',
      };
      const res = await analytics.addDataAndSend(data);
      if (!res) {
        throw 'analytics creation failed!';
      }
      const keys = Object.keys(data).sort();
      expect(keys).toEqual(
        [
          'command',
          'os',
          'version',
          'id',
          'ci',
          'environment',
          'metadata',
          'metrics',
          'args',
          'nodeVersion',
          'standalone',
          'durationMs',
          'integrationName',
          'integrationVersion',
          'integrationEnvironment',
          'integrationEnvironmentVersion',
        ].sort(),
      );
    },
    testTimeout,
  );

  it(
    'Has all analytics arguments when org is specified and args are given',
    async () => {
      analytics.add('foo', 'bar');
      const data = {
        args: [{ integrationName: 'JENKINS', integrationVersion: '1.2.3' }],
        command: '__test__',
        org: '__snyk__',
      };
      const res = await analytics.addDataAndSend(data);
      if (!res) {
        throw 'analytics creation failed!';
      }
      const keys = Object.keys(data).sort();
      expect(keys).toEqual(
        [
          'command',
          'os',
          'version',
          'id',
          'ci',
          'environment',
          'metadata',
          'metrics',
          'args',
          'nodeVersion',
          'standalone',
          'durationMs',
          'org',
          'integrationName',
          'integrationVersion',
          'integrationEnvironment',
          'integrationEnvironmentVersion',
        ].sort(),
      );
    },
    testTimeout,
  );

  it(
    'Has analytics given values',
    async () => {
      analytics.add('foo', 'bar');
      const data = {
        args: [{ integrationName: 'JENKINS', integrationVersion: '1.2.3' }],
        command: '__test__',
        org: '__snyk__',
      };
      const res = await analytics.addDataAndSend(data);
      if (!res) {
        throw 'analytics creation failed!';
      }
      const vals = Object.values(data);
      expect(vals).toContain('__test__');
      expect(vals).toContain('__snyk__');
      expect(vals).toContain('JENKINS');
      expect(vals).toContain('1.2.3');
    },
    testTimeout,
  );
});

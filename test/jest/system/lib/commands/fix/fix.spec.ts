import { exec } from 'child_process';
import * as pathLib from 'path';
import stripAnsi from 'strip-ansi';

import { fakeServer } from '../../../../../acceptance/fake-server';

describe('snyk fix (system tests)', () => {
  const main = './bin/snyk'.replace(/\//g, pathLib.sep);
  const testTimeout = 50000;

  const apiKey = '123456789';
  const port = process.env.PORT || process.env.SNYK_PORT || '12345';
  const BASE_API = '/api/v1';
  const SNYK_API = 'http://localhost:' + port + BASE_API;
  const SNYK_HOST = 'http://localhost:' + port;

  const server = fakeServer(BASE_API, apiKey);

  const noVulnsProjectPath = pathLib.join(
    __dirname,
    '/acceptance',
    'workspaces',
    'no-vulns',
  );

  const env = {
    ...process.env,
    SNYK_TOKEN: apiKey,
    SNYK_API,
    SNYK_HOST,
  };

  beforeAll(async () => {
    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it(
    '`errors when FF is not enabled`',
    (done) => {
      exec(
        `node ${main} fix --org=no-flag`,
        {
          env,
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toEqual(2);
          expect(stdout).toMatch(
            "`snyk fix` is not supported for org 'no-flag'.\nSee documentation on how to enable this beta feature: https://support.snyk.io/hc/en-us/articles/4403417279505-Automatic-remediation-with-snyk-fix",
          );
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`shows error when called with --unmanaged`',
    (done) => {
      exec(
        `node ${main} fix --unmanaged`,
        {
          env,
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toEqual(2);
          expect(stdout).toMatch(
            "`snyk fix` is not supported for ecosystem 'cpp'",
          );
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`shows error when called with --docker (deprecated)`',
    (done) => {
      exec(
        `node ${main} fix --docker`,
        {
          env,
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toEqual(2);
          expect(stdout).toMatch(
            "`snyk fix` is not supported for ecosystem 'docker'",
          );
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`shows error when called with --code`',
    (done) => {
      exec(
        `node ${main} fix --code`,
        {
          env,
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toEqual(2);
          expect(stdout).toMatch(
            "`snyk fix` is not supported for ecosystem 'code'",
          );
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`shows expected response when nothing could be fixed + returns exit code 2`',
    (done) => {
      exec(
        `node ${main} fix ${noVulnsProjectPath}`,
        {
          env,
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(stripAnsi(stdout)).toMatch('No successful fixes');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toBe(2);
          done();
        },
      );
    },
    testTimeout,
  );
});

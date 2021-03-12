import { exec } from 'child_process';
import * as pathLib from 'path';
import stripAnsi from 'strip-ansi';

import { fakeServer } from './acceptance/fake-server';
import cli = require('../src/cli/commands');

const main = './dist/cli/index.js'.replace(/\//g, pathLib.sep);
const testTimeout = 50000;
describe('snyk fix (system tests)', () => {
  let oldkey;
  let oldendpoint;
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

  const pipRequirementsTxt = pathLib.join(
    __dirname,
    '/acceptance',
    'workspaces',
    'pip-app',
  );

  const pipCustomRequirementsTxt = pathLib.join(
    __dirname,
    '/acceptance',
    'workspaces',
    'pip-app-custom',
    'base.txt',
  );

  beforeAll(async () => {
    let key = await cli.config('get', 'api');
    oldkey = key;

    key = await cli.config('get', 'endpoint');
    oldendpoint = key;

    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll(async () => {
    delete process.env.SNYK_API;
    delete process.env.SNYK_HOST;
    delete process.env.SNYK_PORT;

    await server.close();
    let key = 'set';
    let value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    await cli.config(key, value);
    if (oldendpoint) {
      await cli.config('endpoint', oldendpoint);
    }
  });
  it(
    '`errors when FF is not enabled`',
    (done) => {
      exec(
        `node ${main} fix --org=no-flag`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(err.message).toMatch('Command failed');
          expect(err.code).toEqual(2);
          expect(stdout).toMatch(
            "`snyk fix` is not supported for org 'no-flag'",
          );
          done();
        },
      );
    },
    testTimeout,
  );
  it(
    '`shows error when called with --source`',
    (done) => {
      exec(
        `node ${main} fix --source`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
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
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
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

  /* this command is different
   * it shows help text not an error when command is not supported
   */
  it(
    '`shows error when called with container (deprecated)`',
    (done) => {
      exec(
        `node ${main} container fix`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout, stderr) => {
          expect(stderr).toBe('');
          expect(stdout).toMatch('COMMANDS');
          expect(err).toBe(null);
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
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
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
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout, stderr) => {
          if (!err) {
            throw new Error('Test expected to return an error');
          }
          expect(stderr).toBe('');
          expect(stripAnsi(stdout)).toMatchSnapshot();
          expect(err.message).toMatch('Command failed');
          expect(err.code).toBe(2);
          done();
        },
      );
    },
    testTimeout,
  );
  it(
    '`shows expected response when Python project was skipped because of missing remediation data --file`',
    (done) => {
      exec(
        `node ${main} fix --file=${pathLib.join(
          pipRequirementsTxt,
          'requirements.txt',
        )}`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout) => {
          expect(stripAnsi(stdout)).toMatchSnapshot();
          done();
        },
      );
    },
    testTimeout,
  );
  it(
    '`shows expected response when Python project was skipped because of missing remediation data --file and custom name`',
    (done) => {
      exec(
        `node ${main} fix --file=${pipCustomRequirementsTxt} --package-manager=pip`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout) => {
          expect(stripAnsi(stdout)).toMatchSnapshot();
          done();
        },
      );
    },
    testTimeout,
  );
  it(
    '`shows expected response when Python project was skipped because of missing remediation data --all-projects`',
    (done) => {
      exec(
        `node ${main} fix ${noVulnsProjectPath}`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout) => {
          expect(stripAnsi(stdout)).toMatchSnapshot();
          done();
        },
      );
    },
    testTimeout,
  );
});

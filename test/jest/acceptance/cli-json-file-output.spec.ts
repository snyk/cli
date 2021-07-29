import { exec } from 'child_process';
import { sep, join } from 'path';
import { readFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fakeServer } from '../../acceptance/fake-server';
import cli = require('../../../src/cli/commands');

const main = './bin/snyk'.replace(/\//g, sep);
const testTimeout = 50000;

describe('test --json-file-output ', () => {
  let oldkey;
  let oldendpoint;
  const apiKey = '123456789';
  const port = process.env.PORT || process.env.SNYK_PORT || '12345';

  const BASE_API = '/api/v1';
  const SNYK_API = 'http://localhost:' + port + BASE_API;
  const SNYK_HOST = 'http://localhost:' + port;

  const server = fakeServer(BASE_API, apiKey);

  const noVulnsProjectPath = join(
    __dirname,
    '../../acceptance',
    'workspaces',
    'no-vulns',
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
    '`can save JSON output to file while sending human readable output to stdout`',
    (done) => {
      const jsonOutputFilename = `${uuidv4()}.json`;
      exec(
        `node ${main} test ${noVulnsProjectPath} --json-file-output=${jsonOutputFilename}`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        (err, stdout) => {
          if (err) {
            throw err;
          }

          expect(stdout).toMatch('Organization:');
          const outputFileContents = readFileSync(jsonOutputFilename, 'utf-8');
          unlinkSync(`./${jsonOutputFilename}`);
          const jsonObj = JSON.parse(outputFileContents);
          const okValue = jsonObj.ok as boolean;
          expect(okValue).toBeTruthy();
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`test --json-file-output produces same JSON output as normal JSON output to stdout`',
    (done) => {
      const jsonOutputFilename = `${uuidv4()}.json`;
      return exec(
        `node ${main} test ${noVulnsProjectPath} --json --json-file-output=${jsonOutputFilename}`,
        {
          env: {
            PATH: process.env.PATH,
            SNYK_TOKEN: apiKey,
            SNYK_API,
            SNYK_HOST,
          },
        },
        async (err, stdout) => {
          if (err) {
            throw err;
          }
          // give file a little time to be finished to be written
          await new Promise((r) => setTimeout(r, 3000));
          const stdoutJson = stdout;
          const outputFileContents = readFileSync(jsonOutputFilename, 'utf-8');
          unlinkSync(`./${jsonOutputFilename}`);
          expect(stdoutJson).toEqual(outputFileContents);
          done();
        },
      );
    },
    testTimeout,
  );
});

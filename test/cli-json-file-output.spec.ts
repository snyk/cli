import { exec } from 'child_process';
import { sep, join } from 'path';
import { readFileSync, unlinkSync, rmdirSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const osName = require('os-name');

const main = './dist/cli/index.js'.replace(/\//g, sep);
const testTimeout = 50000;
const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;
describe('test --json-file-output ', () => {
  const noVulnsProjectPath = join(
    __dirname,
    '/acceptance',
    'workspaces',
    'no-vulns',
  );
  it(
    '`can save JSON output to file while sending human readable output to stdout`',
    async (done) => {
      return exec(
        `node ${main} test ${noVulnsProjectPath} --json-file-output=snyk-direct-json-test-output.json`,
        async (err, stdout) => {
          if (err) {
            throw err;
          }
          // give file a little time to be finished to be written
          await new Promise((r) => setTimeout(r, 5000));
          expect(stdout).toMatch('Organization:');
          const outputFileContents = readFileSync(
            'snyk-direct-json-test-output.json',
            'utf-8',
          );
          unlinkSync('./snyk-direct-json-test-output.json');
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
      return exec(
        `node ${main} test ${noVulnsProjectPath} --json --json-file-output=snyk-direct-json-test-output.json`,
        async (err, stdout) => {
          if (err) {
            throw err;
          }
          // give file a little time to be finished to be written
          await new Promise((r) => setTimeout(r, 3000));
          const stdoutJson = stdout;
          const outputFileContents = readFileSync(
            'snyk-direct-json-test-output.json',
            'utf-8',
          );
          unlinkSync('./snyk-direct-json-test-output.json');
          expect(stdoutJson).toEqual(outputFileContents);
          done();
        },
      );
    },
    testTimeout,
  );

  it(
    '`test --json-file-output can handle a relative path`',
    (done) => {
      // if 'test-output' doesn't exist, created it
      if (!existsSync('test-output')) {
        mkdirSync('test-output');
      }

      const tempFolder = uuidv4();
      const outputPath = `test-output/${tempFolder}/snyk-direct-json-test-output.json`;

      exec(
        `node ${main} test ${noVulnsProjectPath} --json --json-file-output=${outputPath}`,
        async (err, stdout) => {
          if (err) {
            throw err;
          }
          // give file a little time to be finished to be written
          await new Promise((r) => setTimeout(r, 5000));
          const stdoutJson = stdout;
          const outputFileContents = readFileSync(outputPath, 'utf-8');
          unlinkSync(outputPath);
          rmdirSync(`test-output/${tempFolder}`);
          expect(stdoutJson).toEqual(outputFileContents);
          done();
        },
      );
    },
    testTimeout,
  );

  if (isWindows) {
    test(
      '`test --json-file-output can handle an absolute path`',
      () => {
        // if 'test-output' doesn't exist, created it
        if (!existsSync('test-output')) {
          mkdirSync('test-output');
        }

        const tempFolder = uuidv4();
        const outputPath = join(
          process.cwd(),
          `test-output/${tempFolder}/snyk-direct-json-test-output.json`,
        );

        exec(
          `node ${main} test ${noVulnsProjectPath} --json --json-file-output=${outputPath}`,
          async (err, stdout) => {
            if (err) {
              throw err;
            }
            // give file a little time to be finished to be written
            await new Promise((r) => setTimeout(r, 5000));
            const stdoutJson = stdout;
            const outputFileContents = readFileSync(outputPath, 'utf-8');
            unlinkSync(outputPath);
            rmdirSync(`test-output/${tempFolder}`);
            expect(stdoutJson).toEqual(outputFileContents);
          },
        );
      },
      testTimeout,
    );
  }
});

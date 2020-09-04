import { test } from 'tap';
import { exec } from 'child_process';
import { sep, join } from 'path';
import { readFileSync, unlinkSync, rmdirSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const osName = require('os-name');

const main = './dist/cli/index.js'.replace(/\//g, sep);
const iswindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

test('`test --json-file-output can save JSON output to file while sending human readable output to stdout`', (t) => {
  t.plan(2);

  exec(
    `node ${main} test --json-file-output=snyk-direct-json-test-output.json`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(stdout, 'Organization:', 'contains human readable output');
      const outputFileContents = readFileSync(
        'snyk-direct-json-test-output.json',
        'utf-8',
      );
      unlinkSync('./snyk-direct-json-test-output.json');
      const jsonObj = JSON.parse(outputFileContents);
      const okValue = jsonObj.ok as boolean;
      t.ok(okValue, 'JSON output ok');
    },
  );
});

test('`test --json-file-output produces same JSON output as normal JSON output to stdout`', (t) => {
  t.plan(1);

  exec(
    `node ${main} test --json --json-file-output=snyk-direct-json-test-output.json`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      const stdoutJson = stdout;
      const outputFileContents = readFileSync(
        'snyk-direct-json-test-output.json',
        'utf-8',
      );
      unlinkSync('./snyk-direct-json-test-output.json');
      t.equals(stdoutJson, outputFileContents);
    },
  );
});

test('`test --json-file-output can handle a relative path`', (t) => {
  t.plan(1);

  // if 'test-output' doesn't exist, created it
  if (!existsSync('test-output')) {
    mkdirSync('test-output');
  }

  const tempFolder = uuidv4();
  const outputPath = `test-output/${tempFolder}/snyk-direct-json-test-output.json`;

  exec(
    `node ${main} test --json --json-file-output=${outputPath}`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      const stdoutJson = stdout;
      const outputFileContents = readFileSync(outputPath, 'utf-8');
      unlinkSync(outputPath);
      rmdirSync(`test-output/${tempFolder}`);
      t.equals(stdoutJson, outputFileContents);
    },
  );
});

test(
  '`test --json-file-output can handle an absolute path`',
  { skip: iswindows },
  (t) => {
    t.plan(1);

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
      `node ${main} test --json --json-file-output=${outputPath}`,
      (err, stdout) => {
        if (err) {
          throw err;
        }
        const stdoutJson = stdout;
        const outputFileContents = readFileSync(outputPath, 'utf-8');
        unlinkSync(outputPath);
        rmdirSync(`test-output/${tempFolder}`);
        t.equals(stdoutJson, outputFileContents);
      },
    );
  },
);

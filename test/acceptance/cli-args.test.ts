import { test } from 'tap';
import { exec } from 'child_process';
import { sep } from 'path';

const main = './dist/cli/index.js'.replace(/\//g, sep);

// TODO(kyegupov): make these work in Windows
test('snyk test command should fail when --file is not specified correctly', (t) => {
  t.plan(1);

  exec(`node ${main} test --file package-lock.json`, (err, stdout, stderr) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'Empty --file argument. Did you mean --file=path/to/file ?',
      'correct error output',
    );
  });
});

test('snyk test command should fail when --packageManager is not specified correctly', (t) => {
  t.plan(1);

  exec(`node ${main} test --packageManager=hello`, (err, stdout, stderr) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'Unsupported package manager',
      'correct error output',
    );
  });
});

test('`test multiple paths with --project-name=NAME`', (t) => {
  t.plan(1);

  exec(
    `node ${main} test pathA pathB --project-name=NAME`,
    (err, stdout, stderr) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        'The following option combination is not currently supported: ["multiple paths","project-name"]',
        'correct error output',
      );
    },
  );
});

test('`test --file=file.sln --project-name=NAME`', (t) => {
  t.plan(1);

  exec(
    `node ${main} test --file=file.sln --project-name=NAME`,
    (err, stdout, stderr) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        'The following option combination is not currently supported: ["file=*.sln","project-name"]',
        'correct error output',
      );
    },
  );
});

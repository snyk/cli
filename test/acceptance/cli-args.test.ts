import { test } from 'tap';
import { exec } from 'child_process';
import { sep } from 'path';

const main = './dist/cli/index.js'.replace(/\//g, sep);

// TODO(kyegupov): make these work in Windows
if (sep === '/') {
  test('snyk test command should fail when --file is not specified correctly', (t) => {
    t.plan(1);

    exec(`node ${main} test --file package-lock.json`, (_, stdout) => {
      t.equal(stdout.trim(), 'Empty --file argument. Did you mean --file=path/to/file ?', 'correct error output');
    });
  });
}
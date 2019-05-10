import { test } from 'tap';
import { exec } from 'child_process';
import { sep } from 'path';

const main = './dist/cli/index.js'.replace(/\//g, sep);

// TODO(kyegupov): make these work in Windows
test('snyk test command should fail when --file is not specified correctly', (t) => {
  t.plan(1);
  exec(`node ${main} test --file package-lock.json`, (err, stdout) => {
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
  exec(`node ${main} test --packageManager=hello`, (err, stdout) => {
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
  exec(`node ${main} test pathA pathB --project-name=NAME`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: multiple paths + project-name',
      'correct error output',
    );
  });
});

test('`test that running snyk without any args displays help text`', (t) => {
  t.plan(1);
  exec(`node ${main}`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(stdout.trim(), /Usage/, '`snyk help` text is shown as output');
  });
});

test('`test --file=file.sln --project-name=NAME`', (t) => {
  t.plan(1);
  exec(
    `node ${main} test --file=file.sln --project-name=NAME`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        'The following option combination is not currently supported: file=*.sln + project-name',
        'correct error output',
      );
    },
  );
});

test('`test --file=blah --scan-all-unmanaged`', (t) => {
  t.plan(1);
  exec(`node ${main} test --file=blah --scan-all-unmanaged`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: file + scan-all-unmanaged',
      'correct error output',
    );
  });
});

test('`test --file=blah and --all-projects`', (t) => {
  t.plan(1);
  exec(`node ${main} test --file=blah --all-projects`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: project-name or file or package-manager or docker + all-projects',
      'correct error output',
    );
  });
});

test('`test --package-manager and --all-projects`', (t) => {
  t.plan(1);
  exec(
    `node ${main} test --package-manager=npm --all-projects`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        'The following option combination is not currently supported: project-name or file or package-manager or docker + all-projects',
        'correct error output',
      );
    },
  );
});

test('`test --project-name and --all-projects`', (t) => {
  t.plan(1);
  exec(
    `node ${main} test --project-name=my-monorepo --all-projects`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        'The following option combination is not currently supported: project-name or file or package-manager or docker + all-projects',
        'correct error output',
      );
    },
  );
});

test('`test --docker and --all-projects`', (t) => {
  t.plan(1);
  exec(`node ${main} test --docker --all-projects`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: project-name or file or package-manager or docker + all-projects',
      'correct error output',
    );
  });
});

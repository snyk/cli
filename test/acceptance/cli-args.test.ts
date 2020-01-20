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

const argsNotAllowedWithAllProjects = [
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
];

argsNotAllowedWithAllProjects.forEach((arg) => {
  test(`using --${arg} and --all-projects displays error message`, (t) => {
    t.plan(2);
    exec(`node ${main} test --${arg} --all-projects`, (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        `The following option combination is not currently supported: ${arg} + all-projects`,
        'when using test',
      );
    });
    exec(`node ${main} monitor --${arg} --all-projects`, (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        `The following option combination is not currently supported: ${arg} + all-projects`,
        'when using monitor',
      );
    });
  });
});

test('`test --exclude without --all-project displays error message`', (t) => {
  t.plan(1);
  exec(`node ${main} test --exclude=test`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.equals(
      stdout.trim(),
      'The --exclude option can only be use in combination with --all-projects.',
    );
  });
});

test('`test --exclude without any value displays error message`', (t) => {
  t.plan(1);
  exec(`node ${main} test --all-projects --exclude`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.equals(
      stdout.trim(),
      'Empty --exclude argument. Did you mean --exclude=subdirectory ?',
    );
  });
});

test('`test --exclude=path/to/dir displays error message`', (t) => {
  t.plan(1);
  const exclude = 'path/to/dir'.replace(/\//g, sep);
  exec(
    `node ${main} test --all-projects --exclude=${exclude}`,
    (err, stdout) => {
      if (err) {
        throw err;
      }
      t.equals(
        stdout.trim(),
        'The --exclude argument must be a comma seperated list of directory names and cannot contain a path.',
      );
    },
  );
});

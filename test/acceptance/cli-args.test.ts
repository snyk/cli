import { test } from 'tap';
import { exec } from 'child_process';
import * as path from 'path';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UnsupportedOptionCombinationError } from '../../src/lib/errors/unsupported-option-combination-error';

const osName = require('os-name');

const main = path.normalize('./dist/cli/index.js');
const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

function randomTmpFolderPath(): string {
  const tmpRootFolder = './tmp-test';
  if (!existsSync(tmpRootFolder)) {
    mkdirSync(tmpRootFolder);
  }
  const tmpPath = path.normalize(`${tmpRootFolder}/${uuidv4()}`);
  mkdirSync(tmpPath);

  return tmpPath;
}

// TODO(kyegupov): make these work in Windows
test('snyk test command should fail when --file is not specified correctly', (t) => {
  t.plan(1);
  exec(`node ${main} test --file package-lock.json`, (err, stdout) => {
    if (err) {
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      'Empty --file argument. Did you mean --file=path/to/file ?',
      'correct error output',
    );
  });
});

test(
  'snyk version command should show cli version',
  { skip: isWindows },
  (t) => {
    t.plan(1);
    exec(`node ${main} --version`, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.match(stdout.trim(), /[0-9]+\.[0-9]+\.[0-9]+/, 'version is shown');
    });
  },
);

test('snyk test command should fail when --packageManager is not specified correctly', (t) => {
  t.plan(1);
  exec(`node ${main} test --packageManager=hello`, (err, stdout) => {
    if (err) {
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      'Unsupported package manager',
      'correct error output',
    );
  });
});

test('snyk test command should fail when iac --file is specified', (t) => {
  t.plan(1);
  exec(
    `node ${main} iac test --file=./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.match(
        stdout.trim(),
        'Not a recognised option, did you mean "snyk iac test ./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml"? ' +
          'Check other options by running snyk iac --help',
        'correct error output',
      );
    },
  );
});

test('snyk test command should fail when iac file is not supported', (t) => {
  t.plan(1);
  exec(
    `node ${main} iac test ./test/acceptance/workspaces/empty/readme.md`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.match(
        stdout.trim(),
        'Illegal infrastructure as code target file',
        'correct error output',
      );
    },
  );
});

test('snyk test command should fail when iac file is not supported', (t) => {
  t.plan(1);
  exec(
    `node ${main} iac test ./test/acceptance/workspaces/helmconfig/Chart.yaml`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.match(
        stdout.trim(),
        'Not supported infrastructure as code target files in',
        'correct error output',
      );
    },
  );
});
test('`test multiple paths with --project-name=NAME`', (t) => {
  t.plan(1);
  exec(`node ${main} test pathA pathB --project-name=NAME`, (err, stdout) => {
    if (err) {
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: multiple paths + project-name',
      'correct error output',
    );
  });
});

test('`test --file=file.sln --project-name=NAME`', (t) => {
  t.plan(1);
  exec(
    `node ${main} test --file=file.sln --project-name=NAME`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
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
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      'The following option combination is not currently supported: file + scan-all-unmanaged',
      'correct error output',
    );
  });
});

const argsNotAllowedWithYarnWorkspaces = [
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
];

argsNotAllowedWithYarnWorkspaces.forEach((arg) => {
  test(`using --${arg} and --yarn-workspaces displays error message`, (t) => {
    t.plan(2);
    exec(`node ${main} test --${arg} --yarn-workspaces`, (err, stdout) => {
      if (err) {
        throw err;
      }
      t.deepEqual(
        stdout.trim(),
        `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
        'when using test',
      );
    });
    exec(`node ${main} monitor --${arg} --yarn-workspaces`, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.deepEqual(
        stdout.trim(),
        `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
        'when using monitor',
      );
    });
  });
});
const argsNotAllowedWithAllProjects = [
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
  'yarn-workspaces',
];

argsNotAllowedWithAllProjects.forEach((arg) => {
  test(`using --${arg} and --all-projects displays error message`, (t) => {
    t.plan(2);
    exec(`node ${main} test --${arg} --all-projects`, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.deepEqual(
        stdout.trim(),
        `The following option combination is not currently supported: ${arg} + all-projects`,
        'when using test',
      );
    });
    exec(`node ${main} monitor --${arg} --all-projects`, (err, stdout) => {
      if (err) {
        throw err;
      }
      t.deepEqual(
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
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.equals(
      stdout.trim(),
      'The --exclude option can only be use in combination with --all-projects or --yarn-workspaces.',
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
  const exclude = path.normalize('path/to/dir');
  exec(
    `node ${main} test --all-projects --exclude=${exclude}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.equals(
        stdout.trim(),
        'The --exclude argument must be a comma separated list of directory names and cannot contain a path.',
      );
    },
  );
});

test('`other commands not allowed with --json-file-output`', (t) => {
  const commandsNotCompatibleWithJsonFileOutput = [
    'auth',
    'config',
    'help',
    'ignore',
    'modules',
    'monitor',
    'policy',
    'protect',
    'version',
    'wizard',
    'woof',
  ];

  t.plan(commandsNotCompatibleWithJsonFileOutput.length);

  for (const nextCommand of commandsNotCompatibleWithJsonFileOutput) {
    exec(`node ${main} ${nextCommand} --json-file-output`, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.match(
        stdout.trim(),
        `The following option combination is not currently supported: ${nextCommand} + json-file-output`,
        `correct error output when ${nextCommand} is used with --json-file-output`,
      );
    });
  }
});

test('`test --json-file-output no value produces error message`', (t) => {
  const optionsToTest = [
    '--json-file-output',
    '--json-file-output=',
    '--json-file-output=""',
    "--json-file-output=''",
  ];

  t.plan(optionsToTest.length);

  const validate = (jsonFileOutputOption: string) => {
    const fullCommand = `node ${main} test ${jsonFileOutputOption}`;
    exec(fullCommand, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.equals(
        stdout.trim(),
        'Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?',
      );
    });
  };

  optionsToTest.forEach(validate);
});

test('`test --json-file-output can save JSON output to file while sending human readable output to stdout`', (t) => {
  t.plan(2);
  const tmpFolder = randomTmpFolderPath();
  const jsonPath = path.normalize(
    `${tmpFolder}/snyk-direct-json-test-output.json`,
  );

  const testFixture =
    'test/acceptance/workspaces/npm-package-no-vulns/package.json';

  exec(
    `node ${main} test --file=${testFixture} --json-file-output=${jsonPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      if (!existsSync(jsonPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const outputFileContents = readFileSync(jsonPath, 'utf-8');
      const jsonObj = JSON.parse(outputFileContents);
      const okValue = jsonObj.ok as boolean;

      t.match(stdout, 'Organization:', 'contains human readable output');
      t.ok(okValue, 'JSON output ok');
    },
  );
});

test('`test --json-file-output produces same JSON output as normal JSON output to stdout`', (t) => {
  t.plan(1);
  const tmpFolder = randomTmpFolderPath();
  const jsonPath = path.normalize(
    `${tmpFolder}/snyk-direct-json-test-output.json`,
  );
  const testFixture =
    'test/acceptance/workspaces/npm-package-no-vulns/package.json';
  exec(
    `node ${main} test --file=${testFixture} --json --json-file-output=${jsonPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      const stdoutJson = stdout;
      if (!existsSync(jsonPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const outputFileContents = readFileSync(jsonPath, 'utf-8');

      t.equals(stdoutJson, outputFileContents);
    },
  );
});

test('`test --json-file-output can handle a relative path`', (t) => {
  t.plan(1);
  const tmpFolder = randomTmpFolderPath();
  const outputPath = path.normalize(
    `${tmpFolder}/snyk-direct-json-test-output.json`,
  );
  const testFixture =
    'test/acceptance/workspaces/npm-package-no-vulns/package.json';
  exec(
    `node ${main} test --file=${testFixture} --json --json-file-output=${outputPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      const stdoutJson = stdout;
      if (!existsSync(outputPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const outputFileContents = readFileSync(outputPath, 'utf-8');

      t.equals(stdoutJson, outputFileContents);
    },
  );
});

test(
  '`test --json-file-output can handle an absolute path`',
  { skip: isWindows },
  (t) => {
    t.plan(1);
    const tmpFolder = randomTmpFolderPath();
    const outputPath = path.normalize(
      `${tmpFolder}/snyk-direct-json-test-output.json`,
    );
    const testFixture =
      'test/acceptance/workspaces/npm-package-no-vulns/package.json';
    exec(
      `node ${main} test --file=${testFixture} --json --json-file-output=${outputPath}`,
      (err, stdout) => {
        if (err) {
          console.log('CLI stdout: ', stdout);
          throw err;
        }
        const stdoutJson = stdout;
        if (!existsSync(outputPath)) {
          console.log('CLI stdout: ', stdout);
        }
        const outputFileContents = readFileSync(outputPath, 'utf-8');

        t.equals(stdoutJson, outputFileContents);
      },
    );
  },
);

test('flags not allowed with --sarif', (t) => {
  t.plan(4);
  exec(`node ${main} test iac --sarif --json`, (err, stdout) => {
    if (err) {
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
      'Display unsupported combination error message (iac)',
    );
    t.equal(
      stdout.trim().split('\n').length,
      1,
      'Error message should not include stacktrace (iac)',
    );
  });

  exec(`node ${main} test container --sarif --json`, (err, stdout) => {
    if (err) {
      console.log('CLI stdout: ', stdout);
      throw err;
    }
    t.match(
      stdout.trim(),
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
      'Display unsupported combination error message (container)',
    );
    t.equal(
      stdout.trim().split('\n').length,
      1,
      'Error message should not include stacktrace (container)',
    );
  });
});

test('test --sarif-file-output no value produces error message', (t) => {
  const optionsToTest = [
    '--sarif-file-output',
    '--sarif-file-output=',
    '--sarif-file-output=""',
    "--sarif-file-output=''",
  ];

  t.plan(optionsToTest.length);

  const validate = (sarifFileOutputOption: string) => {
    const fullCommand = `node ${main} test ${sarifFileOutputOption}`;
    exec(fullCommand, (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      t.equals(
        stdout.trim(),
        'Empty --sarif-file-output argument. Did you mean --file=path/to/output-file.json ?',
      );
    });
  };

  optionsToTest.forEach(validate);
});

test('`container test --json-file-output can be used at the same time as --sarif-file-output`', (t) => {
  t.plan(3);
  const tmpFolder = randomTmpFolderPath();
  const jsonPath = path.normalize(
    `${tmpFolder}/snyk-direct-json-test-output.json`,
  );
  const sarifPath = path.normalize(
    `${tmpFolder}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${main} container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath} --json-file-output=${jsonPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      if (!existsSync(sarifPath)) {
        console.log('CLI stdout: ', stdout);
      }
      if (!existsSync(jsonPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));
      const jsonOutput = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      t.match(stdout, 'Organization:', 'contains human readable output');
      t.ok(jsonOutput.ok, 'JSON output OK');
      t.match(sarifOutput.version, '2.1.0', 'SARIF output OK');
      t.end();
    },
  );
});

test('`test --sarif-file-output can be used at the same time as --sarif`', (t) => {
  t.plan(2);
  const tmpFolder = randomTmpFolderPath();
  const sarifPath = path.normalize(
    `${tmpFolder}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${main} container test hello-world --sarif --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      if (!existsSync(sarifPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));

      t.match(stdout, 'rules', 'stdout is sarif');
      t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
      t.end();
    },
  );
});

test('`test --sarif-file-output without vulns`', (t) => {
  t.plan(1);
  const tmpFolder = randomTmpFolderPath();
  const sarifPath = path.normalize(
    `${tmpFolder}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${main} container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
    (err, stdout) => {
      if (err) {
        console.log('CLI stdout: ', stdout);
        throw err;
      }
      if (!existsSync(sarifPath)) {
        console.log('CLI stdout: ', stdout);
      }
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));

      t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
      t.end();
    },
  );
});

test(
  '`test ubuntu --sarif-file-output can be used at the same time as --json with vulns`',
  { skip: isWindows },
  (t) => {
    t.plan(2);
    const tmpFolder = randomTmpFolderPath();
    const sarifPath = path.normalize(
      `${tmpFolder}/snyk-direct-sarif-test-output.json`,
    );
    const dockerfilePath = path.normalize(
      'test/acceptance/fixtures/docker/Dockerfile',
    );

    exec(
      `node ${main} container test ubuntu --json --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
      (err, stdout) => {
        if (err) {
          console.log('CLI stdout: ', stdout);
          throw err;
        }
        if (!existsSync(sarifPath)) {
          console.log('CLI stdout: ', stdout);
        }
        const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));

        const jsonObj = JSON.parse(stdout);
        t.notEqual(jsonObj.vulnerabilities.length, 0, 'has vulns');
        t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
        t.end();
      },
    );
  },
);

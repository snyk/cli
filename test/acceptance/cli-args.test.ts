import { test } from 'tap';
import { exec } from 'child_process';
import { sep, join } from 'path';
import { readFileSync, unlinkSync, rmdirSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { UnsupportedOptionCombinationError } from '../../src/lib/errors/unsupported-option-combination-error';

const osName = require('os-name');

const main = './dist/cli/index.js'.replace(/\//g, sep);
const iswindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

const islinux =
  osName()
    .toLowerCase()
    .indexOf('linux') === 0;

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

test(
  'snyk version command should show cli version or sha',
  { skip: iswindows },
  (t) => {
    t.plan(1);
    exec(`node ${main} --version`, (err, stdout) => {
      if (err) {
        throw err;
      }
      t.match(
        stdout.trim(),
        ':', // can't guess branch or sha or dirty files, but we do always add `:`
        'version is shown',
      );
    });
  },
);

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

test('snyk test command should fail when iac --file is specified', (t) => {
  t.plan(1);
  exec(
    `node ${main} iac test --file=./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml`,
    (err, stdout) => {
      if (err) {
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
  const exclude = 'path/to/dir'.replace(/\//g, sep);
  exec(
    `node ${main} test --all-projects --exclude=${exclude}`,
    (err, stdout) => {
      if (err) {
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

test('flags not allowed with --sarif', (t) => {
  t.plan(1);
  exec(`node ${main} test --sarif --json`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
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

test(
  '`container test --json-file-output can be used at the same time as --sarif-file-output`',
  { skip: iswindows },
  (t) => {
    t.plan(3);

    exec(
      `node ${main} container test alpine --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json --json-file-output=snyk-direct-json-test-output.json`,
      (err, stdout) => {
        if (err) {
          throw err;
        }

        const sarifOutput = JSON.parse(
          readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
        );
        const jsonOutput = JSON.parse(
          readFileSync('snyk-direct-json-test-output.json', 'utf-8'),
        );

        unlinkSync('./snyk-direct-json-test-output.json');
        unlinkSync('./snyk-direct-sarif-test-output.json');

        t.match(stdout, 'Organization:', 'contains human readable output');

        t.ok(jsonOutput.ok, 'JSON output OK');
        t.match(sarifOutput.version, '2.1.0', 'SARIF output OK');
        t.end();
      },
    );
  },
);

test(
  '`container test --json-file-output can be used at the same time as --sarif-file-output`',
  { skip: islinux },
  (t) => {
    t.plan(3);

    exec(
      `node ${main} container test snyk/runtime-fixtures:alpine-windows --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json --json-file-output=snyk-direct-json-test-output.json`,
      (err, stdout) => {
        if (err) {
          throw err;
        }

        const sarifOutput = JSON.parse(
          readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
        );
        const jsonOutput = JSON.parse(
          readFileSync('snyk-direct-json-test-output.json', 'utf-8'),
        );

        unlinkSync('./snyk-direct-json-test-output.json');
        unlinkSync('./snyk-direct-sarif-test-output.json');

        t.match(stdout, 'Organization:', 'contains human readable output');

        t.ok(jsonOutput.ok, 'JSON output OK');
        t.match(sarifOutput.version, '2.1.0', 'SARIF output OK');
        t.end();
      },
    );
  },
);

test(
  '`test --sarif-file-output can be used at the same time as --sarif`',
  { skip: iswindows },
  (t) => {
    t.plan(2);

    exec(
      `node ${main} container test alpine --sarif --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json`,
      (err, stdout) => {
        if (err) {
          throw err;
        }
        const sarifOutput = JSON.parse(
          readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
        );

        unlinkSync('./snyk-direct-sarif-test-output.json');

        t.match(stdout, 'rules', 'stdout is sarif');

        t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
        t.end();
      },
    );
  },
);

test(
  '`test --sarif-file-output can be used at the same time as --sarif`',
  { skip: islinux },
  (t) => {
    t.plan(2);

    exec(
      `node ${main} container test snyk/runtime-fixtures:alpine-windows --sarif --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json`,
      (err, stdout) => {
        if (err) {
          throw err;
        }
        const sarifOutput = JSON.parse(
          readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
        );

        unlinkSync('./snyk-direct-sarif-test-output.json');

        t.match(stdout, 'rules', 'stdout is sarif');

        t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
        t.end();
      },
    );
  },
);

test('`test --sarif-file-output without vulns`', { skip: iswindows }, (t) => {
  t.plan(1);

  exec(
    `node ${main} container test alpine --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json`,
    (err) => {
      if (err) {
        throw err;
      }
      const sarifOutput = JSON.parse(
        readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
      );

      unlinkSync('./snyk-direct-sarif-test-output.json');

      t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
      t.end();
    },
  );
});

test('`test --sarif-file-output without vulns`', { skip: islinux }, (t) => {
  t.plan(1);

  exec(
    `node ${main} container test snyk/runtime-fixtures:alpine-windows --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json`,
    (err) => {
      if (err) {
        throw err;
      }
      const sarifOutput = JSON.parse(
        readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
      );

      unlinkSync('./snyk-direct-sarif-test-output.json');

      t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
      t.end();
    },
  );
});

test(
  '`test ubuntu --sarif-file-output can be used at the same time as --json with vulns`',
  { skip: iswindows },
  (t) => {
    t.plan(2);

    exec(
      `node ${main} container test ubuntu --json --file=test/acceptance/fixtures/docker/Dockerfile --sarif-file-output=snyk-direct-sarif-test-output.json`,
      (err, stdout) => {
        if (err) {
          throw err;
        }
        const sarifOutput = JSON.parse(
          readFileSync('snyk-direct-sarif-test-output.json', 'utf-8'),
        );

        unlinkSync('./snyk-direct-sarif-test-output.json');

        const jsonObj = JSON.parse(stdout);
        t.notEqual(jsonObj.vulnerabilities.length, 0, 'has vulns');
        t.match(sarifOutput.version, '2.1.0', 'SARIF output file OK');
        t.end();
      },
    );
  },
);

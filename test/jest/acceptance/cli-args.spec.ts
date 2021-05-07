import { exec } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnsupportedOptionCombinationError } from '../../../src/lib/errors/unsupported-option-combination-error';
import osName = require('os-name');

const cli = path.normalize('./dist/cli/index.js');

const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

const createOutputDirectory = (): string => {
  const outputPath = path.normalize(`test-output/${uuidv4()}`);
  fse.ensureDirSync(outputPath);
  return outputPath;
};

jest.setTimeout(1000 * 60 * 5);

test('snyk test command should fail when --file is not specified correctly', (done) => {
  exec(`node ${cli} test --file package-lock.json`, (err, stdout) => {
    expect(stdout.trim()).toMatch(
      'Empty --file argument. Did you mean --file=path/to/file ?',
    );
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

if (!isWindows) {
  test('snyk version command should show cli version', (done) => {
    exec(`node ${cli} --version`, (err, stdout) => {
      expect(stdout.trim()).toMatch(/[0-9]+\.[0-9]+\.[0-9]+/);
      expect(err).toBeNull();
      done();
    });
  });
}

test('snyk test command should fail when --packageManager is not specified correctly', (done) => {
  exec(`node ${cli} test --packageManager=hello`, (err, stdout) => {
    expect(stdout.trim()).toMatch('Unsupported package manager');
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

test('snyk test command should fail when iac --file is specified', (done) => {
  exec(
    `node ${cli} iac test --file=./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml`,
    (err, stdout) => {
      expect(stdout.trim()).toMatch('Unsupported flag');
      expect(err).toHaveProperty('code', 2);
      done();
    },
  );
});

test('snyk test command should fail when iac file is not supported', (done) => {
  exec(
    `node ${cli} iac test ./test/acceptance/workspaces/empty/readme.md`,
    (err, stdout) => {
      expect(stdout.trim()).toMatch(
        'Illegal infrastructure as code target file',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    },
  );
});

test('snyk test command should fail when iac file is not supported', (done) => {
  exec(
    `node ${cli} iac test ./test/acceptance/workspaces/helmconfig/Chart.yaml`,
    (err, stdout) => {
      expect(stdout.trim()).toMatch(
        'Not supported infrastructure as code target files in',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    },
  );
});
test('`test multiple paths with --project-name=NAME`', (done) => {
  exec(`node ${cli} test pathA pathB --project-name=NAME`, (err, stdout) => {
    expect(stdout.trim()).toMatch(
      'The following option combination is not currently supported: multiple paths + project-name',
    );
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

test('`test --file=file.sln --project-name=NAME`', (done) => {
  exec(
    `node ${cli} test --file=file.sln --project-name=NAME`,
    (err, stdout) => {
      expect(stdout.trim()).toMatch(
        'The following option combination is not currently supported: file=*.sln + project-name',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    },
  );
});

test('`test --file=blah --scan-all-unmanaged`', (done) => {
  exec(`node ${cli} test --file=blah --scan-all-unmanaged`, (err, stdout) => {
    expect(stdout.trim()).toMatch(
      'The following option combination is not currently supported: file + scan-all-unmanaged',
    );
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

[
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
].forEach((arg) => {
  test(`test using --${arg} and --yarn-workspaces displays error message`, (done) => {
    exec(`node ${cli} test --${arg} --yarn-workspaces`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });

  test(`monitor using --${arg} and --yarn-workspaces displays error message`, (done) => {
    exec(`node ${cli} monitor --${arg} --yarn-workspaces`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
});

[
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
  'yarn-workspaces',
].forEach((arg) => {
  test(`test using --${arg} and --all-projects displays error message`, (done) => {
    exec(`node ${cli} test --${arg} --all-projects`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        `The following option combination is not currently supported: ${arg} + all-projects`,
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
  test(`monitor using --${arg} and --all-projects displays error message`, (done) => {
    exec(`node ${cli} monitor --${arg} --all-projects`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        `The following option combination is not currently supported: ${arg} + all-projects`,
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
});

test('`test --exclude without --all-project displays error message`', (done) => {
  exec(`node ${cli} test --exclude=test`, (err, stdout) => {
    expect(stdout.trim()).toEqual(
      'The --exclude option can only be use in combination with --all-projects or --yarn-workspaces.',
    );
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

test('`test --exclude without any value displays error message`', (done) => {
  exec(`node ${cli} test --all-projects --exclude`, (err, stdout) => {
    expect(stdout.trim()).toEqual(
      'Empty --exclude argument. Did you mean --exclude=subdirectory ?',
    );
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

test('`test --exclude=path/to/dir displays error message`', (done) => {
  const exclude = path.normalize('path/to/dir');
  exec(
    `node ${cli} test --all-projects --exclude=${exclude}`,
    (err, stdout) => {
      expect(stdout.trim()).toEqual(
        'The --exclude argument must be a comma separated list of directory names and cannot contain a path.',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    },
  );
});

[
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
].forEach((command) => {
  test(`${command} not allowed with --json-file-output`, (done) => {
    exec(`node ${cli} ${command} --json-file-output`, (err, stdout) => {
      expect(stdout.trim()).toMatch(
        `The following option combination is not currently supported: ${command} + json-file-output`,
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
});

const optionsToTest = [
  '--json-file-output',
  '--json-file-output=',
  '--json-file-output=""',
  "--json-file-output=''",
];

optionsToTest.forEach((option) => {
  test('`test --json-file-output no value produces error message`', (done) => {
    exec(`node ${cli} test ${option}`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        'Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
});

test('iac test with flags not allowed with --sarif', (done) => {
  exec(`node ${cli} test iac --sarif --json`, (err, stdout) => {
    expect(stdout.trim()).toMatch(
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
    );
    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

test('iac container with flags not allowed with --sarif', (done) => {
  exec(`node ${cli} test container --sarif --json`, (err, stdout) => {
    expect(stdout.trim()).toEqual(
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
    );
    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(err).toHaveProperty('code', 2);
    done();
  });
});

[
  '--sarif-file-output',
  '--sarif-file-output=',
  '--sarif-file-output=""',
  "--sarif-file-output=''",
].forEach((option) => {
  test('test --sarif-file-output no value produces error message', (done) => {
    exec(`node ${cli} test ${option}`, (err, stdout) => {
      expect(stdout.trim()).toEqual(
        'Empty --sarif-file-output argument. Did you mean --file=path/to/output-file.json ?',
      );
      expect(err).toHaveProperty('code', 2);
      done();
    });
  });
});

test('`container test --json-file-output can be used at the same time as --sarif-file-output`', (done) => {
  const outputDir = createOutputDirectory();
  const jsonPath = path.normalize(
    `${outputDir}/snyk-direct-json-test-output.json`,
  );
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${cli} container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath} --json-file-output=${jsonPath}`,
    (err, stdout) => {
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));
      const jsonOutput = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      expect(stdout).toMatch('Organization:');
      expect(jsonOutput.ok).toEqual(true);
      expect(sarifOutput.version).toMatch('2.1.0');
      expect(err).toBeNull();
      done();
    },
  );
});

test('`test --sarif-file-output can be used at the same time as --sarif`', (done) => {
  const outputDir = createOutputDirectory();
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${cli} container test hello-world --sarif --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
    (err, stdout) => {
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));

      expect(stdout).toMatch('rules');
      expect(sarifOutput.version).toMatch('2.1.0');
      expect(err).toBeNull();
      done();
    },
  );
});

test('`test --sarif-file-output without vulns`', (done) => {
  const outputDir = createOutputDirectory();
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  exec(
    `node ${cli} container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
    (err) => {
      const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));
      expect(sarifOutput.version).toMatch('2.1.0');
      expect(err).toBeNull();
      done();
    },
  );
});

if (!isWindows) {
  test('`test ubuntu --sarif-file-output can be used at the same time as --json with vulns`', (done) => {
    const outputDir = createOutputDirectory();
    const sarifPath = path.normalize(
      `${outputDir}/snyk-direct-sarif-test-output.json`,
    );
    const dockerfilePath = path.normalize(
      'test/acceptance/fixtures/docker/Dockerfile',
    );

    exec(
      `node ${cli} container test ubuntu --json --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
      (err, stdout) => {
        const sarifOutput = JSON.parse(readFileSync(sarifPath, 'utf-8'));
        const jsonObj = JSON.parse(stdout);

        expect(jsonObj.vulnerabilities.length).toBeGreaterThan(0);
        expect(sarifOutput.version).toMatch('2.1.0');
        expect(err).toHaveProperty('code', 1);
        done();
      },
    );
  });
}

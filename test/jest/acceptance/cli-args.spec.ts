import * as fse from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnsupportedOptionCombinationError } from '../../../src/lib/errors/unsupported-option-combination-error';
import { runSnykCLI } from '../util/runSnykCLI';

const createOutputDirectory = (): string => {
  const outputPath = path.normalize(`test-output/${uuidv4()}`);
  fse.ensureDirSync(outputPath);
  return outputPath;
};

jest.setTimeout(1000 * 60 * 5);

test('snyk test command should fail when --file is not specified correctly', async () => {
  const { code, stdout } = await runSnykCLI(`test --file package-lock.json`);
  expect(stdout).toMatch(
    'Empty --file argument. Did you mean --file=path/to/file ?',
  );
  expect(code).toEqual(2);
});

test('snyk version command should show cli version', async () => {
  const { code, stdout } = await runSnykCLI(`--version`);
  expect(stdout).toMatch(/[0-9]+\.[0-9]+\.[0-9]+/);
  expect(code).toEqual(0);
});

test('snyk test command should fail when --packageManager is not specified correctly', async () => {
  const { code, stdout } = await runSnykCLI(`test --packageManager=hello`);
  expect(stdout).toMatch('Unsupported package manager');
  expect(code).toEqual(2);
});

test('snyk test command should fail when iac --file is specified', async () => {
  const { code, stdout } = await runSnykCLI(
    `iac test --file=./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml`,
  );

  expect(stdout).toMatch('Unsupported flag');
  expect(code).toEqual(2);
});

test('snyk test command should fail when iac file is not supported', async () => {
  const { code, stdout } = await runSnykCLI(
    `iac test ./test/acceptance/workspaces/empty/readme.md --legacy`,
  );

  expect(stdout).toMatch('Illegal infrastructure as code target file');
  expect(code).toEqual(2);
});

test('snyk test command should fail when iac file is not supported', async () => {
  const { code, stdout } = await runSnykCLI(
    `iac test ./test/acceptance/workspaces/helmconfig/Chart.yaml --legacy`,
  );

  expect(stdout).toMatch(
    'Not supported infrastructure as code target files in',
  );
  expect(code).toEqual(2);
});

test('test multiple paths with --project-name=NAME', async () => {
  const { code, stdout } = await runSnykCLI(
    `test pathA pathB --project-name=NAME`,
  );
  expect(stdout).toMatch(
    'The following option combination is not currently supported: multiple paths + project-name',
  );
  expect(code).toEqual(2);
});

test('test --file=file.sln --project-name=NAME', async () => {
  const { code, stdout } = await runSnykCLI(
    `test --file=file.sln --project-name=NAME`,
  );

  expect(stdout).toMatch(
    'The following option combination is not currently supported: file=*.sln + project-name',
  );
  expect(code).toEqual(2);
});

test('test --file=blah --scan-all-unmanaged', async () => {
  const { code, stdout } = await runSnykCLI(
    `test --file=blah --scan-all-unmanaged`,
  );
  expect(stdout).toMatch(
    'The following option combination is not currently supported: file + scan-all-unmanaged',
  );
  expect(code).toEqual(2);
});

[
  'file',
  'package-manager',
  'project-name',
  'docker',
  'all-sub-projects',
].forEach((arg) => {
  test(`test using --${arg} and --yarn-workspaces displays error message`, async () => {
    const { code, stdout } = await runSnykCLI(
      `test --${arg} --yarn-workspaces`,
    );
    expect(stdout).toEqual(
      `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
    );
    expect(code).toEqual(2);
  });

  test(`monitor using --${arg} and --yarn-workspaces displays error message`, async () => {
    const { code, stdout } = await runSnykCLI(
      `monitor --${arg} --yarn-workspaces`,
    );
    expect(stdout).toEqual(
      `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
    );
    expect(code).toEqual(2);
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
  test(`test using --${arg} and --all-projects displays error message`, async () => {
    const { code, stdout } = await runSnykCLI(`test --${arg} --all-projects`);
    expect(stdout).toEqual(
      `The following option combination is not currently supported: ${arg} + all-projects`,
    );
    expect(code).toEqual(2);
  });

  test(`monitor using --${arg} and --all-projects displays error message`, async () => {
    const { code, stdout } = await runSnykCLI(
      `monitor --${arg} --all-projects`,
    );
    expect(stdout).toEqual(
      `The following option combination is not currently supported: ${arg} + all-projects`,
    );
    expect(code).toEqual(2);
  });
});

test('test --exclude without --all-project displays error message', async () => {
  const { code, stdout } = await runSnykCLI(`test --exclude=test`);
  expect(stdout).toEqual(
    'The --exclude option can only be use in combination with --all-projects or --yarn-workspaces.',
  );
  expect(code).toEqual(2);
});

test('test --exclude without any value displays error message', async () => {
  const { code, stdout } = await runSnykCLI(`test --all-projects --exclude`);
  expect(stdout).toEqual(
    'Empty --exclude argument. Did you mean --exclude=subdirectory ?',
  );
  expect(code).toEqual(2);
});

test('test --exclude=path/to/dir displays error message', async () => {
  const exclude = path.normalize('path/to/dir');
  const { code, stdout } = await runSnykCLI(
    `test --all-projects --exclude=${exclude}`,
  );

  expect(stdout).toEqual(
    'The --exclude argument must be a comma separated list of directory or file names and cannot contain a path.',
  );
  expect(code).toEqual(2);
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
  test(`${command} not allowed with --json-file-output`, async () => {
    const { code, stdout } = await runSnykCLI(`${command} --json-file-output`);
    expect(stdout).toMatch(
      `The following option combination is not currently supported: ${command} + json-file-output`,
    );
    expect(code).toEqual(2);
  });
});

const optionsToTest = [
  '--json-file-output',
  '--json-file-output=',
  '--json-file-output=""',
  "--json-file-output=''",
];

optionsToTest.forEach((option) => {
  test('test --json-file-output no value produces error message', async () => {
    const { code, stdout } = await runSnykCLI(`test ${option}`);
    expect(stdout).toEqual(
      'Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?',
    );
    expect(code).toEqual(2);
  });
});

test('iac test with flags not allowed with --sarif', async () => {
  const { code, stdout } = await runSnykCLI(`test iac --sarif --json`);
  expect(stdout).toMatch(
    new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
      .userMessage,
  );
  expect(stdout.trim().split('\n')).toHaveLength(1);
  expect(code).toEqual(2);
});

test('iac container with flags not allowed with --sarif', async () => {
  const { code, stdout } = await runSnykCLI(`test container --sarif --json`);
  expect(stdout).toEqual(
    new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
      .userMessage,
  );
  expect(stdout.trim().split('\n')).toHaveLength(1);
  expect(code).toEqual(2);
});

[
  '--sarif-file-output',
  '--sarif-file-output=',
  '--sarif-file-output=""',
  "--sarif-file-output=''",
].forEach((option) => {
  test('test --sarif-file-output no value produces error message', async () => {
    const { code, stdout } = await runSnykCLI(`test ${option}`);
    expect(stdout).toEqual(
      'Empty --sarif-file-output argument. Did you mean --file=path/to/output-file.json ?',
    );
    expect(code).toEqual(2);
  });
});

test('container test --json-file-output can be used at the same time as --sarif-file-output', async () => {
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

  const { code, stdout } = await runSnykCLI(
    `container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath} --json-file-output=${jsonPath}`,
  );

  const sarifOutput = JSON.parse(await fse.readFile(sarifPath, 'utf-8'));
  const jsonOutput = JSON.parse(await fse.readFile(jsonPath, 'utf-8'));

  expect(stdout).toMatch('Organization:');
  expect(jsonOutput.ok).toEqual(true);
  expect(sarifOutput.version).toMatch('2.1.0');
  expect(code).toEqual(0);
});

test('container test --sarif-file-output can be used at the same time as --sarif', async () => {
  const outputDir = createOutputDirectory();
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  const { code, stdout } = await runSnykCLI(
    `container test hello-world --sarif --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
  );

  const sarifOutput = JSON.parse(await fse.readFile(sarifPath, 'utf-8'));

  expect(stdout).toMatch('rules');
  expect(sarifOutput.version).toMatch('2.1.0');
  expect(code).toEqual(0);
});

test('container test --sarif-file-output without vulns', async () => {
  const outputDir = createOutputDirectory();
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  const { code } = await runSnykCLI(
    `container test hello-world --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
  );

  const sarifOutput = JSON.parse(await fse.readFile(sarifPath, 'utf-8'));
  expect(sarifOutput.version).toMatch('2.1.0');
  expect(code).toEqual(0);
});

test('container test --sarif-file-output can be used at the same time as --json', async () => {
  const outputDir = createOutputDirectory();
  const sarifPath = path.normalize(
    `${outputDir}/snyk-direct-sarif-test-output.json`,
  );
  const dockerfilePath = path.normalize(
    'test/acceptance/fixtures/docker/Dockerfile',
  );

  const { code, stdout } = await runSnykCLI(
    `container test hello-world --json --file=${dockerfilePath} --sarif-file-output=${sarifPath}`,
  );

  const sarifOutput = JSON.parse(await fse.readFile(sarifPath, 'utf-8'));
  const jsonOutput = JSON.parse(stdout);

  expect(jsonOutput.ok).toEqual(true);
  expect(sarifOutput.version).toMatch('2.1.0');
  expect(code).toEqual(0);
});

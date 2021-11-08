import * as fse from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UnsupportedOptionCombinationError } from '../../../src/lib/errors/unsupported-option-combination-error';
import { runSnykCLI } from '../util/runSnykCLI';
import { fakeServer } from '../../acceptance/fake-server';

const createOutputDirectory = (): string => {
  const outputPath = path.normalize(`test-output/${uuidv4()}`);
  fse.ensureDirSync(outputPath);
  return outputPath;
};

const isWindows =
  require('os-name')()
    .toLowerCase()
    .indexOf('windows') === 0;

jest.setTimeout(1000 * 60 * 5);

describe('cli args', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('snyk test command should fail when --file is not specified correctly', async () => {
    const { code, stdout } = await runSnykCLI(`test --file package-lock.json`, {
      env,
    });
    expect(stdout).toMatch(
      'Empty --file argument. Did you mean --file=path/to/file ?',
    );
    expect(code).toEqual(2);
  });

  test('snyk version command should show cli version', async () => {
    const { code, stdout } = await runSnykCLI(`--version`, {
      env,
    });
    expect(stdout).toMatch(/[0-9]+\.[0-9]+\.[0-9]+/);
    expect(code).toEqual(0);
  });

  test('snyk test command should fail when --packageManager is not specified correctly', async () => {
    const { code, stdout } = await runSnykCLI(`test --packageManager=hello`, {
      env,
    });
    expect(stdout).toMatch('Unsupported package manager');
    expect(code).toEqual(2);
  });

  test('snyk test command should fail when iac --file is specified', async () => {
    const { code, stdout } = await runSnykCLI(
      `iac test --file=./test/acceptance/workspaces/iac-kubernetes/multi-file.yaml`,
      {
        env,
      },
    );

    expect(stdout).toMatch('Unsupported flag');
    expect(code).toEqual(2);
  });

  test('iac test command should fail when file is not supported', async () => {
    const { code, stdout } = await runSnykCLI(
      `iac test ./test/acceptance/workspaces/empty/readme.md --legacy`,
      {
        env,
      },
    );

    expect(stdout).toMatch('Illegal infrastructure as code target file');
    expect(code).toEqual(2);
  });

  test('iac test command should fail when helm file is not supported', async () => {
    const { code, stdout } = await runSnykCLI(
      `iac test ./test/acceptance/workspaces/helmconfig/Chart.yaml --legacy`,
      {
        env,
      },
    );

    expect(stdout).toMatch(
      'Not supported infrastructure as code target files in',
    );
    expect(code).toEqual(2);
  });

  test('snyk test multiple paths with --project-name=NAME', async () => {
    const { code, stdout } = await runSnykCLI(
      `test pathA pathB --project-name=NAME`,
      {
        env,
      },
    );
    expect(stdout).toMatch(
      'The following option combination is not currently supported: multiple paths + project-name',
    );
    expect(code).toEqual(2);
  });

  test('snyk test --file=file.sln --project-name=NAME', async () => {
    const { code, stdout } = await runSnykCLI(
      `test --file=file.sln --project-name=NAME`,
      {
        env,
      },
    );

    expect(stdout).toMatch(
      'The following option combination is not currently supported: file=*.sln + project-name',
    );
    expect(code).toEqual(2);
  });

  test('snyk test --file=blah --scan-all-unmanaged', async () => {
    const { code, stdout } = await runSnykCLI(
      `test --file=blah --scan-all-unmanaged`,
      {
        env,
      },
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
        {
          env,
        },
      );
      expect(stdout).toMatch(
        `The following option combination is not currently supported: ${arg} + yarn-workspaces`,
      );
      expect(code).toEqual(2);
    });

    test(`monitor using --${arg} and --yarn-workspaces displays error message`, async () => {
      const { code, stdout } = await runSnykCLI(
        `monitor --${arg} --yarn-workspaces`,
        {
          env,
        },
      );
      expect(stdout).toMatch(
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
      expect(stdout).toMatch(
        `The following option combination is not currently supported: ${arg} + all-projects`,
      );
      expect(code).toEqual(2);
    });

    test(`monitor using --${arg} and --all-projects displays error message`, async () => {
      const { code, stdout } = await runSnykCLI(
        `monitor --${arg} --all-projects`,
        {
          env,
        },
      );
      expect(stdout).toMatch(
        `The following option combination is not currently supported: ${arg} + all-projects`,
      );
      expect(code).toEqual(2);
    });
  });

  test('snyk test --exclude without --all-project displays error message', async () => {
    const { code, stdout } = await runSnykCLI(`test --exclude=test`, {
      env,
    });
    expect(stdout).toMatch(
      'The --exclude option can only be use in combination with --all-projects or --yarn-workspaces.',
    );
    expect(code).toEqual(2);
  });

  test('snyk test --exclude without any value displays error message', async () => {
    const { code, stdout } = await runSnykCLI(`test --all-projects --exclude`, {
      env,
    });
    expect(stdout).toMatch(
      'Empty --exclude argument. Did you mean --exclude=subdirectory ?',
    );
    expect(code).toEqual(2);
  });

  test('snyk test --exclude=path/to/dir displays error message', async () => {
    const exclude = path.normalize('path/to/dir');
    const { code, stdout } = await runSnykCLI(
      `test --all-projects --exclude=${exclude}`,
      {
        env,
      },
    );

    expect(stdout).toMatch(
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
      const { code, stdout } = await runSnykCLI(
        `${command} --json-file-output`,
        {
          env,
        },
      );
      expect(stdout).toMatch(
        `The following option combination is not currently supported: ${command} + json-file-output`,
      );
      expect(code).toEqual(2);
    });
  });

  test('project attributes are implemented --project{-business-criticality, -lifecycle, -environment}', async () => {
    const { code, stdout } = await runSnykCLI(
      `monitor --project-business-criticality`,
      {
        env,
      },
    );
    expect(stdout).toMatch(
      "--project-business-criticality must contain an '=' with a comma-separated list of values. To clear all existing values, pass no values i.e. --project-business-criticality=",
    );
    expect(code).toEqual(2);
  });

  test('snyk monitor --project-tags is implemented', async () => {
    const { code, stdout } = await runSnykCLI(`monitor --project-tags`, {
      env,
    });
    expect(stdout).toMatch(
      "--project-tags must contain an '=' with a comma-separated list of pairs (also separated with an '='). To clear all existing values, pass no values i.e. --project-tags=",
    );
    expect(code).toEqual(2);
  });

  test('snyk container monitor --project-tags is implemented', async () => {
    const { code, stdout } = await runSnykCLI(
      `container monitor alpine --project-tags`,
      {
        env,
      },
    );
    expect(stdout).toMatch(
      "--project-tags must contain an '=' with a comma-separated list of pairs (also separated with an '='). To clear all existing values, pass no values i.e. --project-tags=",
    );
    expect(code).toEqual(2);
  });

  const optionsToTest = [
    '--json-file-output',
    '--json-file-output=',
    '--json-file-output=""',
    "--json-file-output=''",
  ];

  optionsToTest.forEach((option) => {
    test('snyk test --json-file-output no value produces error message', async () => {
      const { code, stdout } = await runSnykCLI(`test ${option}`, {
        env,
      });
      expect(stdout).toMatch(
        'Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?',
      );
      expect(code).toEqual(2);
    });
  });

  test('iac test with flags not allowed with --sarif', async () => {
    const { code, stdout } = await runSnykCLI(`test iac --sarif --json`, {
      env,
    });
    expect(stdout).toMatch(
      new UnsupportedOptionCombinationError(['test', 'sarif', 'json'])
        .userMessage,
    );
    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(code).toEqual(2);
  });

  test('iac container with flags not allowed with --sarif', async () => {
    const { code, stdout } = await runSnykCLI(`test container --sarif --json`, {
      env,
    });
    expect(stdout).toMatch(
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
    test('snyk test --sarif-file-output no value produces error message', async () => {
      const { code, stdout } = await runSnykCLI(`test ${option}`, {
        env,
      });
      expect(stdout).toMatch(
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
      {
        env,
      },
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
      {
        env,
      },
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
      {
        env,
      },
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
      {
        env,
      },
    );

    const sarifOutput = JSON.parse(await fse.readFile(sarifPath, 'utf-8'));
    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.ok).toEqual(true);
    expect(sarifOutput.version).toMatch('2.1.0');
    expect(code).toEqual(0);
  });

  if (!isWindows) {
    // Previously we used to have a bug where --exclude-base-image-vulns returned exit code 2.
    // This test asserts that the bug no longer exists.
    test('container test --file=Dockerfile --exclude-base-image-vulns returns exit code 0', async () => {
      const dockerfilePath = path.normalize(
        'test/acceptance/fixtures/docker/Dockerfile.alpine-3.12.0',
      );

      const { code, stdout } = await runSnykCLI(
        `container test alpine:3.12.0 --json --file=${dockerfilePath} --exclude-base-image-vulns`,
        {
          env,
        },
      );
      const jsonOutput = JSON.parse(stdout);

      expect(jsonOutput.ok).toEqual(true);
      expect(code).toEqual(0);
    });
  }
});

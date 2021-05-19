import { SpawnOptionsWithoutStdio } from 'child_process';
import { spawn } from 'cross-spawn';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as uuid from 'uuid';

type TestProject = {
  path: (filePath?: string) => string;
  file: (filePath: string) => Promise<string>;
};

type RunCLIResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type RunCLIOptions = SpawnOptionsWithoutStdio;

const runCommand = (
  command: string,
  args: string[],
  options?: RunCLIOptions,
): Promise<RunCLIResult> => {
  return new Promise((resolve, reject) => {
    const cli = spawn(command, args, options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    cli.on('error', (error) => {
      reject(error);
    });

    cli.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
    });

    cli.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    cli.on('close', (code) => {
      resolve({
        code: code || 0,
        stdout: Buffer.concat(stdout)
          .toString('utf-8')
          .trim(),
        stderr: Buffer.concat(stderr)
          .toString('utf-8')
          .trim(),
      });
    });
  });
};

const getPatchedLodash = (): Promise<string> => {
  const patchedLodashPath = path.resolve(
    __dirname,
    '../fixtures/patchable-file-lodash/lodash-expected-patched.js',
  );

  return fse.readFile(patchedLodashPath, 'utf-8');
};

jest.setTimeout(1000 * 60);

const useLocalPackage = async (projectPath: string) => {
  const packageRoot = path.resolve(__dirname, '../..');
  await runCommand('npm', ['pack'], {
    cwd: packageRoot,
  });

  const packageJson = JSON.parse(
    await fse.readFile(path.resolve(projectPath, 'package.json'), 'utf-8'),
  );
  packageJson.scripts.prepublish = packageJson.scripts.prepublish.replace(
    '@snyk/protect',
    path.resolve(packageRoot, 'snyk-protect-1.0.0-monorepo.tgz'),
  );
  await fse.writeFile(
    path.resolve(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  );
};

describe('Fix PR "prepublish" hook', () => {
  let tempFolder: string;

  const createProject = async (fixture: string): Promise<TestProject> => {
    const fixturePath = path.resolve(__dirname, '../fixtures', fixture);
    const projectPath = path.resolve(tempFolder, fixture);
    await fse.copy(fixturePath, projectPath);

    if (process.env.PRODUCTION_TEST !== '1') {
      await useLocalPackage(projectPath);
    }

    return {
      path: (filePath = '') => path.resolve(projectPath, filePath),
      file: (filePath: string) => {
        const fullFilePath = path.resolve(projectPath, filePath);
        return fse.readFile(fullFilePath, 'utf-8');
      },
    };
  };

  beforeEach(async () => {
    tempFolder = path.resolve(__dirname, '__outputs__', uuid.v4());
    await fse.ensureDir(tempFolder);
  });

  afterEach(async () => {
    await fse.remove(tempFolder);
    jest.restoreAllMocks();
  });

  test('patches vulnerable dependencies on install', async () => {
    const project = await createProject('fix-pr-prepublish-hook');
    const patchedLodash = await getPatchedLodash();

    const { code, stdout, stderr } = await runCommand('npm', ['install'], {
      cwd: project.path(),
    });

    expect(stderr).toEqual('');
    expect(stdout).toMatch(
      `patched ${project.path('node_modules/lodash/lodash.js')}`,
    );
    expect(code).toEqual(0);
    expect(project.file('node_modules/lodash/lodash.js')).resolves.toEqual(
      patchedLodash,
    );
  });
});

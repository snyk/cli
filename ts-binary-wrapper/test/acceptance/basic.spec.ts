import { TestEnvironmentSetup } from '../util/prepareEnvironment';
import * as common from '../../src/common';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

jest.setTimeout(60 * 1000);

describe('Basic acceptance test', () => {
  const envSetup = new TestEnvironmentSetup();
  const cliVersionForTesting = '1.1080.0';

  beforeEach(async () => {
    process.env.SNYK_DISABLE_ANALYTICS = '1';
    await envSetup.prepareEnvironment(cliVersionForTesting);
  });

  afterEach(() => {
    delete process.env.SNYK_DISABLE_ANALYTICS;
    envSetup.cleanupDirectories();
  });

  it('Bootstrap binary & execute a command', () => {
    const config = common.getCurrentConfiguration();
    const executable = config
      .getLocalLocation()
      .replace(envSetup.inputfolder, envSetup.outputfolder);

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const indexScript = path.join(envSetup.outputfolder, 'index.js');
    const bootstrapScript = path.join(envSetup.outputfolder, 'bootstrap.js');

    // run system under test: bootsrap
    const resultBootstrap = child_process.spawnSync(
      'node ' + bootstrapScript + ' exec',
      { shell: true },
    );
    console.debug(resultBootstrap.stdout.toString());
    console.error(resultBootstrap.stderr.toString());
    expect(resultBootstrap.status).toEqual(0);
    expect(fs.existsSync(executable)).toBeTruthy();

    // run system under test: index
    const resultIndex = child_process.spawnSync(
      'node ' + indexScript + ' --version',
      { shell: true },
    );

    if (resultIndex.status != 0) {
      console.debug(resultIndex);
    }

    expect(resultIndex.status).toEqual(0);
    expect(
      resultIndex.stdout.toString().includes(cliVersionForTesting),
    ).toBeTruthy();

    fs.unlinkSync(executable);
  });

  it('Execute a command without bootstrap', () => {
    const config = common.getCurrentConfiguration();
    const executable = config
      .getLocalLocation()
      .replace(envSetup.inputfolder, envSetup.outputfolder);

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const indexScript = path.join(envSetup.outputfolder, 'index.js');

    // run system under test: index
    const resultIndex = child_process.spawnSync(
      'node ' + indexScript + ' --version',
      { shell: true },
    );

    if (resultIndex.status != 0) {
      console.debug(resultIndex.stdout.toString());
      console.debug(resultIndex.stderr.toString());
    }

    expect(fs.existsSync(executable)).toBeTruthy();
    expect(resultIndex.status).toEqual(0);
    expect(
      resultIndex.stdout.toString().includes(cliVersionForTesting),
    ).toBeTruthy();

    fs.unlinkSync(executable);
  });

  it('Execute with --legacy-cli', () => {
    const config = common.getCurrentConfiguration();
    const executable = config
      .getLocalLocation()
      .replace(envSetup.inputfolder, envSetup.outputfolder);

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const indexScript = path.join(envSetup.outputfolder, 'index.js');

    // run system under test: index
    const resultIndex = child_process.spawnSync(
      'node ' + indexScript + ' --legacy-cli --version',
      { shell: true },
    );

    expect(fs.existsSync(executable)).toBeFalsy();
    expect(resultIndex.status).not.toEqual(0); // we expect this to fail, since the legacy cli is not available in the test, still we want to see that the logic around is working properly
    expect(resultIndex.stdout.toString()).toEqual('');
    expect(resultIndex.stderr.toString()).toContain(
      'You are currently running a degraded version of the Snyk CLI.',
    );
  });

  it('Execute with a failing download', () => {
    const config = common.getCurrentConfiguration();
    const executable = config
      .getLocalLocation()
      .replace(envSetup.inputfolder, envSetup.outputfolder);

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const indexScript = path.join(envSetup.outputfolder, 'index.js');

    // introduce error state by deleting the generated folder
    fs.rmdirSync(path.join(envSetup.outputfolder, 'generated'), {
      recursive: true,
    });

    // run system under test: index
    const resultIndex = child_process.spawnSync(
      'node ' + indexScript + ' --version',
      { shell: true },
    );

    expect(fs.existsSync(executable)).toBeFalsy();
    expect(resultIndex.status).not.toEqual(0); // we expect this to fail, since the legacy cli is not available in the test, still we want to see that the logic around is working properly
    expect(resultIndex.stdout.toString()).toEqual('');
    expect(resultIndex.stderr.toString()).toContain(
      'You are currently running a degraded version of the Snyk CLI.',
    );
  });

  it('Bootstrap binary fails when proxy is used but not allowed', () => {
    // only run when proxy is set
    if (!process.env.https_proxy) {
      console.info('Skipping test because https_proxy is not set');
      return;
    }

    // setup
    const config = common.getCurrentConfiguration();
    const executable = config
      .getLocalLocation()
      .replace(envSetup.inputfolder, envSetup.outputfolder);

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const bootstrapScript = path.join(envSetup.outputfolder, 'bootstrap.js');

    // set NO_PROXY for snyk.io
    process.env.NO_PROXY = '*.snyk.io';

    // run system under test: index
    const resultBootstrap = child_process.spawnSync(
      'node ' + bootstrapScript + ' exec',
      { shell: true, env: { ...process.env } },
    );
    console.debug(resultBootstrap.stdout.toString());
    console.error(resultBootstrap.stderr.toString());

    const expectedErrorMessage = 'ECONNREFUSED';
    const expectedError = resultBootstrap.stderr
      .toString()
      .includes(expectedErrorMessage);

    expect(expectedError).toBeTruthy();
    expect(resultBootstrap.status).toEqual(0);
  });
});

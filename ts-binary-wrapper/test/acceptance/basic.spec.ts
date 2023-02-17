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
    await envSetup.prepareEnvironment(cliVersionForTesting);
  });

  afterEach(async () => {
    await envSetup.cleanupDirectories();
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

    // run system under test: index
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
    expect(resultIndex.output.toString()).toContain(cliVersionForTesting);

    fs.unlinkSync(executable);
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
    expect(resultBootstrap.status).toEqual(1);
  });
});

import { prepareEnvironment } from '../util/prepareEnvironment';
import * as bootstrap from '../../src/bootstrap';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

jest.setTimeout(60 * 1000);

describe('Basic acceptance test', () => {
  it('Bootstrap binary & execute a command', async () => {
    // setup
    const cliVersionForTesting = '1.1080.0';
    const envInfo = await prepareEnvironment(cliVersionForTesting);
    const executable = bootstrap.executable.replace(
      envInfo.inputfolder,
      envInfo.outputfolder,
    );

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const indexScript = path.join(envInfo.outputfolder, 'index.js');
    const bootstrapScript = path.join(envInfo.outputfolder, 'bootstrap.js');

    // run system under test: index
    const resultBootstrap = child_process.spawnSync(
      'node ' + bootstrapScript + ' exec',
      { shell: true },
    );
    console.debug(resultBootstrap.stdout.toString());
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

    try {
      fs.rmSync(envInfo.outputfolder, { recursive: true });
    } catch {
      // to support nodejs 12, which doesn't know rmSync()
      fs.rmdirSync(envInfo.outputfolder, { recursive: true });
    }
  });

  it('Bootstrap binary fails when proxy is used but not allowed', async () => {
    // only run when PROXY_TESTS is set
    if (!process.env.PROXY_TESTS) {
      console.debug('Skipping test because PROXY_TEST is not set');
      return;
    }

    // setup
    const cliVersionForTesting = '1.1080.0';
    const envInfo = await prepareEnvironment(cliVersionForTesting);
    const executable = bootstrap.executable.replace(
      envInfo.inputfolder,
      envInfo.outputfolder,
    );

    try {
      fs.unlinkSync(executable);
    } catch {
      //
    }

    expect(fs.existsSync(executable)).toBeFalsy();

    const bootstrapScript = path.join(envInfo.outputfolder, 'bootstrap.js');

    // set NO_PROXY for snyk.io
    process.env.NO_PROXY = '*.snyk.io';

    // run system under test: index
    const resultBootstrap = child_process.spawnSync(
      'node ' + bootstrapScript + ' exec',
      { shell: true, env: { ...process.env } },
    );
    console.debug(resultBootstrap.stdout.toString());
    expect(resultBootstrap.status).toEqual(1);

    try {
      fs.rmSync(envInfo.outputfolder, { recursive: true });
    } catch {
      // to support nodejs 12, which doesn't know rmSync()
      fs.rmdirSync(envInfo.outputfolder, { recursive: true });
    }
  });
});

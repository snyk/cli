import { startMockServer } from './helpers';
import envPaths from 'env-paths';
import { driftctlVersion } from '../../../../src/lib/iac/drift';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getFixturePath } from '../../util/getFixturePath';
import * as uuid from 'uuid';
import * as rimraf from 'rimraf';
import { processDriftctlOutput } from '../../../../src/lib/iac/drift';
import { DescribeOptions } from '../../../../src/lib/iac/types';

const paths = envPaths('snyk');

jest.setTimeout(50000);

describe('iac describe', () => {
  let run: (
    cmd: string,
    env: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let apiUrl: string;

  let tmpFolderPath: string;
  let outputFile: string;
  beforeEach(() => {
    tmpFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dctl-'));
    outputFile = path.join(tmpFolderPath, uuid.v4());
  });
  afterEach(() => {
    rimraf.sync(tmpFolderPath);
  });

  beforeAll(async () => {
    ({ run, teardown, apiUrl } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('describe fail when not used as an iac sub-command', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk describe`, {});

    expect(stdout).toContain('Unknown command "describe"');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  it('describe fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac describe --all --org=no-iac-drift-entitlements`,
      {
        SNYK_DRIFTCTL_PATH: './iac/drift/args-echo',
      },
    );

    expect(stdout).toMatch(
      'Command "drift" is currently not supported for this org. To enable it, please contact snyk support.',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (os.platform() === 'win32') {
    return; // skip following tests
  }

  it('Test when driftctl scan exit in error', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk iac describe  --all`, {
      SNYK_FIXTURE_OUTPUT_PATH: outputFile,
      DCTL_EXIT_CODE: '2',
      SNYK_DRIFTCTL_PATH: path.join(
        getFixturePath('iac'),
        'drift',
        'args-echo.sh',
      ),
    });

    expect(stdout).toMatch('');
    expect(stderr).toMatch('something wrong happened');
    expect(exitCode).toBe(2);
  });

  it('Launch driftctl from SNYK_DRIFTCTL_PATH env var when org has the entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk iac describe  --all`, {
      SNYK_FIXTURE_OUTPUT_PATH: outputFile,
      SNYK_DRIFTCTL_PATH: path.join(
        getFixturePath('iac'),
        'drift',
        'args-echo.sh',
      ),
    });

    const output = fs.readFileSync(outputFile).toString();
    const expectedPipedOutput = fs
      .readFileSync(
        path.join(getFixturePath('iac'), 'drift', 'output', 'output.json'),
      )
      .toString();

    // First invocation of driftctl scan triggered by describe cmd
    expect(output).toContain('DCTL_IS_SNYK=true');
    expect(output).toContain(
      `ARGS=scan --no-version-check --output json://stdout --config-dir ${paths.cache} --to aws+tf`,
    );

    // Second invocation of driftctl fmt triggered by describe cmd
    // We should test that stdin is piped from previous execution
    expect(output).toContain('ARGS=fmt --no-version-check');
    expect(output).toContain(`STDIN=${expectedPipedOutput}`);

    expect(stdout).toMatch('');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
  });

  describe('Test html file output', () => {
    let htmlFile: string;
    const fixtureHtmlReport = path.join(
      getFixturePath('iac'),
      'drift',
      'output',
      'driftctl_output.html',
    );
    beforeEach(() => {
      htmlFile = path.join(tmpFolderPath, 'foobar.html');
      fs.copyFileSync(fixtureHtmlReport, htmlFile);
    });
    afterEach(() => {
      rimraf.sync(htmlFile);
    });

    it('Launch driftctl with html output format', async () => {
      const { stdout, stderr, exitCode } = await run(
        `snyk iac describe --all --html-file-output=${htmlFile}`,
        {
          SNYK_FIXTURE_OUTPUT_PATH: outputFile,
          SNYK_DRIFTCTL_PATH: path.join(
            getFixturePath('iac'),
            'drift',
            'args-echo.sh',
          ),
        },
      );

      expect(stdout).toBe('');
      expect(stderr).toBe('');
      expect(exitCode).toBe(0);

      const output = fs.readFileSync(outputFile).toString();

      // First invocation of driftctl scan triggered by describe cmd
      expect(output).toContain('DCTL_IS_SNYK=true');
      expect(output).toContain(
        `ARGS=scan --no-version-check --output json://stdout --config-dir ${paths.cache} --to aws+tf`,
      );

      // Second invocation of driftctl fmt triggered by describe cmd
      // We should test that the format is properly set for fmt command
      expect(output).toContain(
        `ARGS=fmt --no-version-check --output html://${htmlFile}`,
      );
    });
  });

  it('Download and launch driftctl when executable is not found and org has the entitlement', async () => {
    const cachedir = path.join(os.tmpdir(), 'driftctl_download_' + Date.now());
    const { stderr, exitCode } = await run(`snyk iac describe --all`, {
      SNYK_DRIFTCTL_URL: apiUrl + '/download/driftctl',
      SNYK_CACHE_PATH: cachedir,
    });

    expect(stderr).toMatch('download ok');
    expect(exitCode).toBe(2);
    expect(
      fs.existsSync(path.join(cachedir, 'driftctl_' + driftctlVersion)),
    ).toBe(true);
  });
});

describe('processDriftctlOutput', () => {
  it('test that html in stdout is parsed correctly', async () => {
    const inputData = fs.readFileSync(
      path.join(
        getFixturePath('iac'),
        'drift',
        'output',
        'driftctl_output.html',
      ),
    );
    const expectedOutputData = fs.readFileSync(
      path.join(getFixturePath('iac'), 'drift', 'output', 'snyk_output.html'),
    );

    const opts: DescribeOptions = {
      kind: 'fmt',
      html: true,
    };
    const output = processDriftctlOutput(opts, inputData.toString('utf8'));

    expect(output).toBe(expectedOutputData.toString('utf8'));
  });

  it('test that html in file is parsed correctly', async () => {
    const inputData = fs.readFileSync(
      path.join(
        getFixturePath('iac'),
        'drift',
        'output',
        'driftctl_output.html',
      ),
    );
    const expectedOutputData = fs.readFileSync(
      path.join(getFixturePath('iac'), 'drift', 'output', 'snyk_output.html'),
    );

    const tmpFilepath = '/tmp/snyk-html-test.html';
    fs.writeFileSync(tmpFilepath, inputData);

    const opts: DescribeOptions = {
      kind: 'fmt',
      'html-file-output': tmpFilepath,
    };
    processDriftctlOutput(opts, inputData.toString('utf8'));

    const data = fs.readFileSync(tmpFilepath, {
      encoding: 'utf8',
    });
    expect(data).toBe(expectedOutputData.toString('utf8'));

    fs.unlinkSync(tmpFilepath);
  });
});

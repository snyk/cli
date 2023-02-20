import * as common from '../../src/common';
import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(60 * 1000);

const binaryDeployments = fs.readFileSync('binary-deployments.json', 'utf8');
const supportedPlatforms = JSON.parse(binaryDeployments);

describe('Determine Binary Name', () => {
  it('Determine Binary Name (darwin)', async () => {
    const expected = supportedPlatforms['darwin']['amd64'];
    const actualx64 = common.determineBinaryName('darwin', 'x64');
    const actualarm64 = common.determineBinaryName('darwin', 'arm64');
    const actualamd64 = common.determineBinaryName('darwin', 'amd64');
    expect(actualx64).toEqual(expected);
    expect(actualarm64).toEqual(expected);
    expect(actualamd64).toEqual(expected);
  });

  it('Determine Binary Name (win)', async () => {
    const expected = supportedPlatforms['windows']['amd64'];
    const actualx64 = common.determineBinaryName('win32', 'x64');
    const actualamd64 = common.determineBinaryName('win32', 'amd64');
    expect(actualx64).toEqual(expected);
    expect(actualamd64).toEqual(expected);
  });

  it('Determine Binary Name (linux)', async () => {
    const expectedx64 = supportedPlatforms['linux']['amd64'];
    const expectedarm64 = supportedPlatforms['linux']['arm64'];
    const actualx64 = common.determineBinaryName('linux', 'x64');
    const actualamd64 = common.determineBinaryName('linux', 'amd64');
    const actualarm64 = common.determineBinaryName('linux', 'arm64');
    expect(actualx64).toEqual(expectedx64);
    expect(actualamd64).toEqual(expectedx64);
    expect(actualarm64).toEqual(expectedarm64);
  });

  it('Determine Binary Name (alpine)', async () => {
    const expectedx64 = supportedPlatforms['alpine']['amd64'];
    const actualx64 = common.determineBinaryName('alpine', 'x64');
    const actualamd64 = common.determineBinaryName('alpine', 'amd64');
    expect(actualx64).toEqual(expectedx64);
    expect(actualamd64).toEqual(expectedx64);
  });

  it('Unsupported Architecture', async () => {
    try {
      common.determineBinaryName('linux', 'mipsel');
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe('Get Version', () => {
  it('Version available', async () => {
    const expected = '1.1080.0';
    const file = path.join(__dirname, 'test-version' + Math.random());
    fs.writeFileSync(file, '1.1080.0\n');

    const actual = common.getCurrentVersion(file);
    expect(actual).toEqual(expected);

    fs.unlinkSync(file);
  });

  it('Version file not available', async () => {
    const expected = '';
    const file = path.join(__dirname, 'not-existing-file');

    const actual = common.getCurrentVersion(file);
    expect(actual).toEqual(expected);
  });
});

describe('Get Shasum', () => {
  it('Shasum available (multiple)', async () => {
    const expected = '0a238fe123';
    const file = path.join(__dirname, 'sha256sums.txt' + Math.random());
    fs.writeFileSync(
      file,
      '098fe123  *snyk-win\n12345  *snyk-macos\ncecece  *snyk-linux-arm64\n0a238fe123  *snyk-linux',
    );

    const actual = common.getCurrentSha256sum('snyk-linux', file);
    expect(actual).toEqual(expected);

    fs.unlinkSync(file);
  });

  it('Shasum available (single)', async () => {
    const expected = '0a238fe123';
    const file = path.join(__dirname, 'sha256sums.txt' + Math.random());
    fs.writeFileSync(file, '0a238fe123  snyk-linux\n');

    const actual = common.getCurrentSha256sum('snyk-linux', file);
    expect(actual).toEqual(expected);

    fs.unlinkSync(file);
  });

  it('Shasum not available', async () => {
    const expected = 'unknown-shasum-';
    const file = path.join(__dirname, 'sha256sums.txt' + Math.random());
    fs.writeFileSync(
      file,
      '098fe123  *snyk-win\n12345  *snyk-macos\n0a238fe123  *snyk-linux',
    );

    const actual = common.getCurrentSha256sum('snyk-linux-arm64', file);
    expect(actual).toContain(expected);

    fs.unlinkSync(file);
  });
});

describe('Configuration', () => {
  it('Download and local location', async () => {
    const expectedDownloadLocation =
      'https://static.snyk.io/cli/v1.2.3/snyk-win.exe';
    const expectedLocalLocation = path.join(
      __dirname,
      '..',
      '..',
      'src',
      'snyk-win.exe',
    );
    const config = new common.WrapperConfiguration(
      '1.2.3',
      'snyk-win.exe',
      '1234abcdef',
    );

    const actualDownloadLocation = config.getDownloadLocation();
    expect(actualDownloadLocation).toEqual(expectedDownloadLocation);

    const actualLocalLocation = config.getLocalLocation();
    expect(actualLocalLocation).toEqual(expectedLocalLocation);
  });
});

describe('Testing binary wrapper', () => {
  it('getCliArguments() filter important stuff', async () => {
    const indexFile = path.join(__dirname, '..', '..', 'src', 'index.ts');
    const input = ['ignore', indexFile, 'important', 'stuff'];
    const expected = ['important', 'stuff'];
    const actual = common.getCliArguments(input);
    expect(actual).toEqual(expected);
  });

  it('getCliArguments() filter important stuff (with directory only)', async () => {
    const indexFile = path.join(__dirname, '..', '..', 'src');
    const input = ['ignore', indexFile, 'important', 'stuff'];
    const expected = ['important', 'stuff'];
    const actual = common.getCliArguments(input);
    expect(actual).toEqual(expected);
  });

  it('runWrapper() succesfully', async () => {
    const executable = 'node';
    const cliArguments = ['--version'];
    const expected = 0;
    const actual = common.runWrapper(executable, cliArguments);
    expect(actual).toEqual(expected);
  });

  it('runWrapper() fail', async () => {
    const executable = 'node-unknown';
    const cliArguments = ['--version'];
    const expected = 2;
    const actual = common.runWrapper(executable, cliArguments);
    expect(actual).toEqual(expected);
  });

  it('debugEnabled() false', async () => {
    const cliArguments = ['--version', '--something', 'else'];
    const expected = false;
    const actual = common.debugEnabled(cliArguments);
    expect(actual).toEqual(expected);
  });

  it('debugEnabled() true (--debug)', async () => {
    const cliArguments = ['--version', '--something', '--debug', 'else'];
    const expected = true;
    const actual = common.debugEnabled(cliArguments);
    expect(actual).toEqual(expected);
  });

  it('debugEnabled() true (-d)', async () => {
    const cliArguments = ['--version', '--something', '-d', 'else'];
    const expected = true;
    const actual = common.debugEnabled(cliArguments);
    expect(actual).toEqual(expected);
  });
});

describe('Testing binary bootstrapper', () => {
  it('downloadExecutable() succesfull', async () => {
    const binaryName = 'snyk-macos';
    const shafileExtension = '.sha256';
    const config = new common.WrapperConfiguration('1.1080.0', binaryName, '');
    const shasumFile =
      config.getLocalLocation() + Math.random() + shafileExtension;

    // download the shasum first, here we don't expect a shasum comparison
    const shasumDownload = await common.downloadExecutable(
      config.getDownloadLocation() + shafileExtension,
      shasumFile,
      '',
    );
    expect(shasumDownload).toBeUndefined();
    expect(fs.existsSync(shasumFile)).toBeTruthy();
    const expectedShasum = common.getCurrentSha256sum(binaryName, shasumFile);

    // download binary next and use previously downloaded shasum to check validity
    const binaryDownload = await common.downloadExecutable(
      config.getDownloadLocation(),
      config.getLocalLocation(),
      expectedShasum,
    );
    expect(binaryDownload).toBeUndefined();
    expect(fs.existsSync(config.getLocalLocation())).toBeTruthy();

    const stats = fs.statSync(config.getLocalLocation());
    expect(stats.mode).toEqual(0o100755);

    try {
      // check if the binary is executable
      fs.accessSync(config.getLocalLocation(), fs.constants.X_OK);
    } catch {
      // execution of binary not possible
      expect(false).toBeTruthy();
    }

    fs.unlinkSync(shasumFile);
    fs.unlinkSync(config.getLocalLocation());
  });

  it('downloadExecutable() fails due to incorrect shasum', async () => {
    const binaryName = 'snyk-macos';
    const shafileExtension = '.sha256';
    const config = new common.WrapperConfiguration('1.1080.0', binaryName, '');
    const shasumFile =
      config.getLocalLocation() + Math.random() + shafileExtension;

    // download just any file and state a shasum expectation that never can be fullfilled
    const shasumDownload = await common.downloadExecutable(
      config.getDownloadLocation() + shafileExtension,
      shasumFile,
      'incorrect-shasum',
    );
    expect(shasumDownload?.message).toContain('Shasum comparison failed');
    expect(fs.existsSync(shasumFile)).toBeFalsy();
  });

  it("downloadExecutable() try to download a file that doesn't exist", async () => {
    const binaryName = 'snyk-macos';
    const shafileExtension = '.shoe256';
    const config = new common.WrapperConfiguration('1.1080.0', binaryName, '');
    const shasumFile =
      config.getLocalLocation() + Math.random() + shafileExtension;

    // try to download a file that doesn't exis
    const shasumDownload = await common.downloadExecutable(
      config.getDownloadLocation() + shafileExtension,
      shasumFile,
      'incorrect-shasum',
    );
    expect(shasumDownload?.message).toContain(
      'Download failed! Server Response:',
    );
    expect(fs.existsSync(shasumFile)).toBeFalsy();
  });

  it('downloadExecutable() fails due to an error in the https connection', async () => {
    // download the just any file and state a shasum expectation that never can be fullfilled
    const shasumDownload = await common.downloadExecutable(
      'https://notaurl',
      '',
      '',
    );
    expect(shasumDownload).toBeDefined();
  });
});

describe('isAnalyticsEnabled ', () => {
  it('enabled', async () => {
    delete process.env.SNYK_DISABLE_ANALYTICS;
    expect(common.isAnalyticsEnabled()).toBeTruthy();
  });

  it('disabled', async () => {
    process.env.SNYK_DISABLE_ANALYTICS = '1';
    expect(common.isAnalyticsEnabled()).toBeFalsy();
    delete process.env.SNYK_DISABLE_ANALYTICS;
  });
});

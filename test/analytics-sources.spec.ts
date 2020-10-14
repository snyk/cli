import {
  getIntegrationName,
  getIntegrationVersion,
  INTEGRATION_NAME_HEADER,
  INTEGRATION_VERSION_HEADER,
  isScoop,
  isHomebrew,
  validateHomebrew,
  validateScoopManifestFile,
} from '../src/lib/analytics-sources';

import * as fs from 'fs';

const emptyArgs = [];
const defaultArgsParams = {
  _: [],
  _doubleDashArgs: [],
};

beforeEach(() => {
  delete process.env[INTEGRATION_NAME_HEADER];
  delete process.env[INTEGRATION_VERSION_HEADER];
});

describe('analytics-sources - scoop detection', () => {
  it('detects if snyk is installed via scoop', () => {
    const originalExecPath = process.execPath;
    process.execPath =
      process.cwd() + '/test/fixtures/scoop/good-manifest/snyk-win.exe';
    expect(isScoop()).toBe(true);

    process.execPath = '/test/fixtures/scoop/bad-manifest/snyk-win.exe';
    expect(isScoop()).toBe(false);
    process.execPath = originalExecPath;
  });

  it('validates scoop manifest file', () => {
    let snykExecPath =
      process.cwd() + '/test/fixtures/scoop/good-manifest/snyk-win.exe';
    expect(validateScoopManifestFile(snykExecPath)).toBe(true);

    snykExecPath =
      process.cwd() + '/test/fixtures/scoop/bad-manifest/snyk-win.exe';
    expect(validateScoopManifestFile(snykExecPath)).toBe(false);

    snykExecPath = process.cwd() + '/test/fixtures/scoop/no-exist/snyk-win.exe';
    expect(validateScoopManifestFile(snykExecPath)).toBe(false);
  });
});

describe('analytics-sources - Homebrew detection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects if snyk is installed via Homebrew', () => {
    const originalExecPath = process.execPath;
    process.execPath = process.cwd() + '/usr/local/Cellar/snyk/v1.413.2/bin';
    const fileExistsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    expect(isHomebrew()).toBe(true);
    expect(fileExistsSpy).toHaveBeenCalledTimes(1);
    process.execPath = originalExecPath;
  });

  it('returns false if formula not in Homebrew path', () => {
    const originalExecPath = process.execPath;
    process.execPath =
      process.cwd() + '/usr/local/some-other-location/snyk/v1.413.2/bin';
    const fileExistsSpy = jest.spyOn(fs, 'existsSync');
    expect(isHomebrew()).toBe(false);
    expect(fileExistsSpy).not.toHaveBeenCalled();
    process.execPath = originalExecPath;
  });

  it('returns false if formula files does not exist', () => {
    const originalExecPath = process.execPath;
    process.execPath = process.cwd() + '/usr/local/Cellar/snyk/v1.413.2/bin';
    const fileExistsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(isHomebrew()).toBe(false);
    expect(fileExistsSpy).toHaveBeenCalledTimes(1);
    process.execPath = originalExecPath;
  });

  it('validates Homebrew formula file exists', () => {
    let snykExecPath =
      process.cwd() + '/test/fixtures/homebrew/Cellar/snyk/vX/bin/snyk'; // relies on fixture at /test/fixtures/homebrew/Cellar/vX/.brew/snyk.rb
    expect(validateHomebrew(snykExecPath)).toBe(true);

    snykExecPath =
      process.cwd() +
      '/test/fixtures/homebrew/no-exist/Cellar/snyk/vX/bin/snyk';
    expect(validateHomebrew(snykExecPath)).toBe(false);
  });
});

describe('analytics-sources - getIntegrationName', () => {
  it('integration name is empty by default', () => {
    expect(getIntegrationName(emptyArgs)).toBe('');
  });

  it('integration name is loaded from envvar', () => {
    process.env[INTEGRATION_NAME_HEADER] = 'NPM';
    expect(getIntegrationName(emptyArgs)).toBe('NPM');

    process.env[INTEGRATION_NAME_HEADER] = 'STANDALONE';
    expect(getIntegrationName(emptyArgs)).toBe('STANDALONE');
  });

  it('integration name is empty when envvar is not recognized', () => {
    process.env[INTEGRATION_NAME_HEADER] = 'INVALID';
    expect(getIntegrationName(emptyArgs)).toBe('');
  });

  it('integration name is loaded and formatted from CLI flag', () => {
    expect(
      getIntegrationName([
        { integrationName: 'homebrew', ...defaultArgsParams },
      ]),
    ).toBe('HOMEBREW');
  });

  it('integration name is loaded and validated from CLI flag', () => {
    expect(
      getIntegrationName([
        { integrationName: 'invalid', ...defaultArgsParams },
      ]),
    ).toBe('');
  });

  it('integration name SCOOP when snyk is installed with scoop', () => {
    const originalExecPath = process.execPath;
    process.execPath =
      process.cwd() + '/test/fixtures/scoop/good-manifest/snyk-win.exe';
    expect(getIntegrationName(emptyArgs)).toBe('SCOOP');
    process.execPath = originalExecPath;
  });

  it('integration name HOMEBREW when snyk is installed with Homebrew', () => {
    const originalExecPath = process.execPath;
    process.execPath =
      process.cwd() + '/test/fixtures/homebrew/Cellar/snyk/vX/bin/snyk'; // relies on fixture at /test/fixtures/homebrew/Cellar/vX/.brew/snyk.rb
    expect(getIntegrationName(emptyArgs)).toBe('HOMEBREW');
    process.execPath = originalExecPath;
  });
});

describe('analytics-sources - getIntegrationVersion', () => {
  it('integration version is empty by default', () => {
    expect(getIntegrationVersion(emptyArgs)).toBe('');
  });

  it('integration version is loaded from envvar', () => {
    process.env[INTEGRATION_VERSION_HEADER] = '1.2.3';
    expect(getIntegrationVersion(emptyArgs)).toBe('1.2.3');
  });

  it('integration version is loaded from CLI flag', () => {
    expect(
      getIntegrationVersion([
        { integrationVersion: '1.2.3-Crystal', ...defaultArgsParams },
      ]),
    ).toBe('1.2.3-Crystal');
  });
});

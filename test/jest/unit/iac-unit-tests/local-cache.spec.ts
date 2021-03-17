import * as localCacheModule from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import { REQUIRED_LOCAL_CACHE_FILES } from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import { PassThrough } from 'stream';
import * as needle from 'needle';

describe('initLocalCache - SNYK_IAC_SKIP_BUNDLE_DOWNLOAD is not set', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.SNYK_IAC_SKIP_BUNDLE_DOWNLOAD;
  });

  const fs = require('fs');
  fs.existsSync = jest.fn().mockReturnValue(true);

  it('downloads and extracts the bundle successfully', () => {
    const mockReadable = new PassThrough();
    const spy = jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest.spyOn(needle, 'get').mockReturnValue(mockReadable);

    localCacheModule.initLocalCache();

    expect(spy).toHaveBeenCalledWith(mockReadable);
  });
});

describe('initLocalCache - SNYK_IAC_SKIP_BUNDLE_DOWNLOAD is true', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SNYK_IAC_SKIP_BUNDLE_DOWNLOAD = 'true';
  });

  const fs = require('fs');

  it('skips the download of the bundle', async () => {
    fs.existsSync = jest.fn().mockReturnValue(true);
    jest.spyOn(fileUtilsModule, 'extractBundle');

    await localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
  });

  it('skips the download of the bundle but throws an error', () => {
    const error = new Error(
      `Missing IaC local cache data, please validate you have: \n${REQUIRED_LOCAL_CACHE_FILES.join(
        '\n',
      )}`,
    );
    fs.existsSync = jest.fn().mockReturnValue(false);
    jest.spyOn(fileUtilsModule, 'extractBundle');

    const promise = localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
    expect(promise).rejects.toThrow(error);
  });
});

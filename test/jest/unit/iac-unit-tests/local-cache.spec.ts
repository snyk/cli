import * as localCacheModule from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import { PassThrough } from 'stream';
import * as needle from 'needle';

describe('initLocalCache - downloads bundle successfully', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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

describe('initLocalCache - Missing IaC local cache data', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const fs = require('fs');

  it('throws an error on download', () => {
    const error = new Error(
      'The .iac-data directory can not be created. ' +
        'Please make sure that the current working directory has write permissions',
    );

    fs.existsSync = jest.fn().mockReturnValue(false);
    jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => {
      throw error;
    });

    const promise = localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
    expect(promise).rejects.toThrow(error);
  });
});

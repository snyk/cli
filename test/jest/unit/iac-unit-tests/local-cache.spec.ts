import * as localCacheModule from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import { PassThrough } from 'stream';
import * as needle from 'needle';
import * as rimraf from 'rimraf';
import * as fs from 'fs';
import * as path from 'path';

describe('initLocalCache - downloads bundle successfully', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
  });

  it('downloads and extracts the bundle successfully', () => {
    const mockReadable = new PassThrough();
    const spy = jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest.spyOn(needle, 'get').mockReturnValue(mockReadable);

    localCacheModule.initLocalCache();

    expect(spy).toHaveBeenCalledWith(mockReadable);
  });

  it('cleans up the custom folder after finishes', () => {
    const iacPath: fs.PathLike = path.join(`${process.cwd()}`, '.iac-data');
    const spy = jest.spyOn(rimraf, 'sync');

    localCacheModule.cleanLocalCache();

    expect(spy).toHaveBeenCalledWith(iacPath);
    jest.restoreAllMocks();
    expect(fs.existsSync(iacPath)).toBeFalsy();
  });
});

describe('initLocalCache - Missing IaC local cache data', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
  });

  it('throws an error on download', () => {
    const error = new Error(
      'The .iac-data directory can not be created. ' +
        'Please make sure that the current working directory has write permissions',
    );
    jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => {
      throw error;
    });

    const promise = localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
    expect(promise).rejects.toThrow(error);
  });
});

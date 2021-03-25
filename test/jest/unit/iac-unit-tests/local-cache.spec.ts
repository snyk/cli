import * as localCacheModule from '../../../../src/cli/commands/test/iac-local-execution/local-cache';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import { PassThrough } from 'stream';
import * as needle from 'needle';
import * as rimraf from 'rimraf';
import * as fs from 'fs';
import * as path from 'path';

describe('Directory exists', () => {
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

  it('cleans up the local cache folder after test finishes', () => {
    const iacPath: fs.PathLike = path.join(`${process.cwd()}`, '.iac-data');
    const stats: fs.Stats = new fs.Stats();
    stats.isDirectory = jest.fn().mockReturnValue(true);
    jest.spyOn(fs, 'lstatSync').mockReturnValueOnce(stats);
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['file1', 'file2']);
    const rmdirSyncSpy = jest.spyOn(fs, 'rmdirSync');
    const unlinkSyncSpy = jest
      .spyOn(fs, 'unlinkSync')
      .mockImplementation(() => null);

    localCacheModule.cleanLocalCache();

    expect(unlinkSyncSpy).toHaveBeenNthCalledWith(
      1,
      path.join(iacPath, 'file1'),
    );
    expect(unlinkSyncSpy).toHaveBeenNthCalledWith(
      2,
      path.join(iacPath, 'file2'),
    );
    expect(rmdirSyncSpy).toHaveBeenCalledWith(iacPath);
  });

  describe('Directory does not exist', () => {
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

    it('does not delete the local cacheDir if it does not exist', () => {
      const spy = jest.spyOn(rimraf, 'sync');

      localCacheModule.cleanLocalCache();

      expect(spy).not.toHaveBeenCalled();
    });
  });
});

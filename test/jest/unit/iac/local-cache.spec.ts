import * as localCacheModule from '../../../../src/cli/commands/test/iac/local-execution/local-cache';
import {
  FailedToInitLocalCacheError,
  LOCAL_POLICY_ENGINE_DIR,
} from '../../../../src/cli/commands/test/iac/local-execution/local-cache';
import { IaCErrorCodes } from '../../../../src/cli/commands/test/iac/local-execution/types';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac/local-execution/file-utils';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as request from '../../../../src/lib/request/request';
import * as analytics from '../../../../src/lib/analytics';

describe('initLocalCache - downloads bundle successfully', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
  });

  it('downloads and extracts the bundle successfully', async () => {
    const mockReadable = fs.createReadStream(
      path.join(__dirname, '../../../fixtures/iac/custom-rules/custom.tar.gz'),
    );
    const spy = jest
      .spyOn(fileUtilsModule, 'extractBundle')
      .mockResolvedValue();
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest
      .spyOn(request, 'streamRequest')
      .mockReturnValue(Promise.resolve(mockReadable));

    await localCacheModule.initLocalCache();

    expect(request.streamRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: expect.stringContaining('bundle.tar.gz'),
      }),
    );
    expect(spy).toHaveBeenCalledWith(mockReadable);
  });

  it('extracts the custom rules successfully if valid', async () => {
    const mockReadable = fs.createReadStream(
      path.join(__dirname, '../../../fixtures/iac/custom-rules/custom.tar.gz'),
    );
    const extractBundleSpy = jest
      .spyOn(fileUtilsModule, 'extractBundle')
      .mockResolvedValue();
    jest.spyOn(fileUtilsModule, 'isValidBundle').mockReturnValue(true);
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest
      .spyOn(request, 'streamRequest')
      .mockReturnValue(Promise.resolve(new PassThrough()));
    jest.spyOn(fs, 'createReadStream').mockReturnValue(mockReadable);

    await localCacheModule.initLocalCache({
      customRulesPath: './path/to/custom.tar.gz',
    });

    expect(fs.createReadStream).toHaveBeenCalledWith('./path/to/custom.tar.gz');
    expect(extractBundleSpy).toHaveBeenCalledWith(mockReadable);
  });

  it('fails to extract the custom rules if invalid', async () => {
    const mockReadable = fs.createReadStream(
      path.join(__dirname, '../../../fixtures/iac/custom-rules/custom.tar.gz'),
    );
    const extractBundleSpy = jest
      .spyOn(fileUtilsModule, 'extractBundle')
      .mockResolvedValue();
    jest.spyOn(fileUtilsModule, 'isValidBundle').mockReturnValue(false);
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);
    jest.spyOn(fs, 'createReadStream').mockReturnValue(mockReadable);

    await expect(
      localCacheModule.initLocalCache({
        customRulesPath: './path/to/custom.tar.gz',
      }),
    ).rejects.toThrow(new localCacheModule.InvalidCustomRules(''));

    expect(fs.createReadStream).toHaveBeenCalledWith('./path/to/custom.tar.gz');
    expect(extractBundleSpy).toHaveBeenCalledWith(mockReadable);
  });
});

describe('cleanLocalCache', () => {
  const iacPath = path.normalize(LOCAL_POLICY_ENGINE_DIR);

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(iacPath, { recursive: true, force: true });
  });

  it('removes the local cache directory and its contents', () => {
    fs.mkdirSync(path.join(iacPath, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(iacPath, 'nested', 'bundle.wasm'), 'data');
    const analyticsSpy = jest.spyOn(analytics, 'add');

    localCacheModule.cleanLocalCache();

    expect(fs.existsSync(iacPath)).toBe(false);
    expect(analyticsSpy).not.toHaveBeenCalled();
  });

  it('does not report an error when the local cache directory does not exist', () => {
    fs.rmSync(iacPath, { recursive: true, force: true });
    const analyticsSpy = jest.spyOn(analytics, 'add');

    localCacheModule.cleanLocalCache();

    expect(fs.existsSync(iacPath)).toBe(false);
    expect(analyticsSpy).not.toHaveBeenCalled();
  });

  it('reports an error when the local cache directory cannot be removed', () => {
    const analyticsSpy = jest.spyOn(analytics, 'add');
    jest.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw new Error('EACCES');
    });

    localCacheModule.cleanLocalCache();

    expect(analyticsSpy).toHaveBeenCalledWith(
      'error-code',
      IaCErrorCodes.FailedToCleanLocalCacheError,
    );
  });
});

describe('initLocalCache - errors', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
  });

  it('throws an error on creation of cache dir', async () => {
    const error = new Error(
      `The ${LOCAL_POLICY_ENGINE_DIR} directory can not be created. ` +
        'Please make sure that the current working directory has write permissions',
    );
    jest.spyOn(fileUtilsModule, 'extractBundle');
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => {
      throw error;
    });

    const promise = localCacheModule.initLocalCache();

    expect(fileUtilsModule.extractBundle).not.toHaveBeenCalled();
    await expect(promise).rejects.toThrow(FailedToInitLocalCacheError);
  });
});

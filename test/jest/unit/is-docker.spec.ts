import fs from 'fs';
import path from 'path';

import { isDocker } from '../../../src/lib/is-docker';

describe('isDocker', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inside a Docker container (.dockerenv test)', async () => {
    delete require.cache[path.join(__dirname, 'index.js')];
    const statSyncSpy = jest.spyOn(fs, 'statSync').mockReturnValue({} as any);
    expect(isDocker()).toBeTruthy();
    expect(statSyncSpy).toHaveBeenCalledTimes(1);
    expect(statSyncSpy).toHaveBeenLastCalledWith('/.dockerenv');
  });

  it('inside a Docker container (cgroup test)', async () => {
    delete require.cache[path.join(__dirname, 'index.js')];

    const statSyncSpy = jest.spyOn(fs, 'statSync');
    const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

    statSyncSpy.mockImplementationOnce((path): any => {
      if (path === '/.dockerenv') {
        throw new Error("ENOENT, no such file or directory '/.dockerinit'");
      }
    });

    readFileSyncSpy.mockImplementationOnce((path, options): any => {
      if (path === '/proc/self/cgroup' && options === 'utf8') {
        return 'xxx docker yyyy';
      }
    });

    expect(isDocker()).toEqual(true);
  });

  it('not inside a Docker container', async () => {
    const statSyncSpy = jest.spyOn(fs, 'statSync');
    const readFileSync = jest.spyOn(fs, 'readFileSync');

    statSyncSpy.mockImplementationOnce((path): any => {
      if (path === '/.dockerenv') {
        throw new Error("ENOENT, no such file or directory '/.dockerinit'");
      }
    });

    readFileSync.mockImplementationOnce((): any => {
      throw new Error("ENOENT, no such file or directory '/.dockerinit'");
    });

    expect(isDocker()).toEqual(false);
  });
});

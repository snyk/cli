import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

import * as fileUtils from '../../../../../../src/lib/iac/file-utils';
import { runDriftCTL } from '../../../../../../src/lib/iac/drift/driftctl';

describe('runDriftCTL environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'real-api-token-value',
      SNYK_API: 'https://api.snyk.io',
      SNYK_SYSTEM_HTTP_PROXY: 'http://user-proxy:8080',
      HTTP_PROXY: 'http://go-proxy:9000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('drops SNYK_* variables, restores the user proxy, and sets DCTL_IS_SNYK', async () => {
    jest.spyOn(fileUtils, 'isExe').mockResolvedValue(true);
    const spawnSpy = jest
      .spyOn(childProcess, 'spawn')
      .mockImplementation((() => {
        const proc = new EventEmitter();
        setImmediate(() => proc.emit('exit', 0));
        return proc;
      }) as any);

    await runDriftCTL({ options: { kind: 'describe' } });

    const env = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
    expect(Object.keys(env).filter((key) => /^snyk_/i.test(key))).toEqual([]);
    expect(env.HTTP_PROXY).toBe('http://user-proxy:8080');
    expect(env.DCTL_IS_SNYK).toBe('true');
  });
});

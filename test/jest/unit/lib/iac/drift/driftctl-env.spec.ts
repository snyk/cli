import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

import * as fileUtils from '../../../../../../src/lib/iac/file-utils';
import { runDriftCTL } from '../../../../../../src/lib/iac/drift/driftctl';

const SECRET_VALUES = [
  'real-api-token-value',
  'lowercase-api-token-value',
  'oauth-token-value',
];

describe('runDriftCTL environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SNYK_TOKEN: 'real-api-token-value',
      snyk_token: 'lowercase-api-token-value',
      SNYK_OAUTH_TOKEN: 'oauth-token-value',
      SNYK_API: 'https://api.snyk.io',
      SNYK_SYSTEM_HTTP_PROXY: 'http://user-proxy:8080',
      HTTP_PROXY: 'http://go-proxy:9000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function mockSpawnExit(): jest.SpyInstance {
    jest.spyOn(fileUtils, 'isExe').mockResolvedValue(true);
    return jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
      const proc = new EventEmitter();
      setImmediate(() => proc.emit('exit', 0));
      return proc;
    }) as any);
  }

  it('keeps DCTL_IS_SNYK, restores the user proxy, and drops SNYK_* variables', async () => {
    const spawnSpy = mockSpawnExit();

    await runDriftCTL({ options: { kind: 'describe' } });

    const env = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
    expect(env.DCTL_IS_SNYK).toBe('true');
    expect(env.HTTP_PROXY).toBe('http://user-proxy:8080');
    expect(env.http_proxy).toBe('http://user-proxy:8080');
    expect(Object.keys(env).filter((key) => /^snyk_/i.test(key))).toEqual([]);
    const serialized = JSON.stringify(env);
    for (const secret of SECRET_VALUES) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('keeps the user proxy when the CLI internal proxy has credentials', async () => {
    process.env.HTTP_PROXY = 'http://snyk:secret@127.0.0.1:1234';
    const spawnSpy = mockSpawnExit();

    await runDriftCTL({ options: { kind: 'describe' } });

    const env = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
    expect(env.HTTP_PROXY).toBe('http://user-proxy:8080');
    expect(env.http_proxy).toBe('http://user-proxy:8080');
    expect(env.HTTP_PROXY).not.toContain('secret');
    expect(env.http_proxy).not.toContain('secret');
  });
});

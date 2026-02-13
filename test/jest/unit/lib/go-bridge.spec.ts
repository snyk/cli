import * as childProcess from 'child_process';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

import { execGoCommand, GoCommandResult } from '../../../../src/lib/go-bridge';

interface MockProcess extends childProcess.ChildProcess {
  stdout: Readable;
  stderr: Readable;
}

function createMockProcess(): MockProcess {
  const mockProc = new EventEmitter() as MockProcess;
  mockProc.stdout = new Readable({
    read() {
      return;
    },
  });
  mockProc.stderr = new Readable({
    read() {
      return;
    },
  });
  (mockProc as any).stdin = null;
  return mockProc;
}

describe('go-bridge', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('execGoCommand', () => {
    it('rejects with GeneralCLIFailureError when SNYK_CLI_EXECUTABLE_PATH is not set', async () => {
      delete process.env.SNYK_CLI_EXECUTABLE_PATH;

      const err: ProblemError = await execGoCommand(['depgraph']).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(CLI.GeneralCLIFailureError);
      expect(err.detail).toContain('SNYK_CLI_EXECUTABLE_PATH is not set');
    });

    it('resolves with GoCommandResult on success', async () => {
      process.env.SNYK_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph', '--org=myorg']);

      mockProc.stdout.emit('data', Buffer.from('{"depGraph": {}}'));
      mockProc.emit('close', 0);

      const result: GoCommandResult = await promise;
      expect(result).toEqual({
        exitCode: 0,
        stdout: '{"depGraph": {}}',
        stderr: '',
      });
      expect(childProcess.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/snyk',
        ['depgraph', '--org=myorg'],
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
      );

      jest.restoreAllMocks();
    });

    it('resolves with non-zero exit code instead of rejecting', async () => {
      process.env.SNYK_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph']);

      mockProc.stderr.emit('data', Buffer.from('command not found'));
      mockProc.emit('close', 1);

      const result: GoCommandResult = await promise;
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('command not found');
      expect(result.stdout).toBe('');

      jest.restoreAllMocks();
    });

    it('rejects with GeneralCLIFailureError on spawn error', async () => {
      process.env.SNYK_CLI_EXECUTABLE_PATH = '/nonexistent/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph']);

      mockProc.emit('error', new Error('ENOENT'));

      const err: ProblemError = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(CLI.GeneralCLIFailureError);
      expect(err.detail).toContain('Failed to execute Go CLI: ENOENT');

      jest.restoreAllMocks();
    });

    it('passes cwd option to spawn', async () => {
      process.env.SNYK_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph'], { cwd: '/my/project' });

      mockProc.stdout.emit('data', Buffer.from('{}'));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('{}');

      expect(childProcess.spawn).toHaveBeenCalledWith(
        '/usr/local/bin/snyk',
        ['depgraph'],
        expect.objectContaining({ cwd: '/my/project' }),
      );

      jest.restoreAllMocks();
    });
  });
});

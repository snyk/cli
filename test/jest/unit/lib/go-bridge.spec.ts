import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import * as errorFormat from '../../../../src/lib/error-format';

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
    it('rejects with GeneralCLIFailureError when SNYK_INTERNAL_CLI_EXECUTABLE_PATH is not set', async () => {
      delete process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH;

      const err: ProblemError = await execGoCommand(['depgraph']).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(CLI.GeneralCLIFailureError);
      expect(err.detail).toContain(
        'SNYK_INTERNAL_CLI_EXECUTABLE_PATH is not set',
      );
    });

    it('resolves with GoCommandResult on success', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

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
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

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
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/nonexistent/snyk';

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
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

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

    it('strips SNYK_TOKEN from the child process environment', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';
      process.env.SNYK_TOKEN = 'random';

      const mockProc = createMockProcess();
      const spawnSpy = jest
        .spyOn(childProcess, 'spawn')
        .mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph']);

      mockProc.emit('close', 0);
      await promise;

      const spawnEnv = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
      expect(spawnEnv).toBeDefined();
      expect(spawnEnv.SNYK_TOKEN).toBeUndefined();

      jest.restoreAllMocks();
    });

    it('preserves SNYK_TOKEN when its value is not "random"', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';
      process.env.SNYK_TOKEN = 'real-api-token-value';

      const mockProc = createMockProcess();
      const spawnSpy = jest
        .spyOn(childProcess, 'spawn')
        .mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph']);

      mockProc.emit('close', 0);
      await promise;

      const spawnEnv = spawnSpy.mock.calls[0][2]?.env as NodeJS.ProcessEnv;
      expect(spawnEnv).toBeDefined();
      expect(spawnEnv.SNYK_TOKEN).toBe('real-api-token-value');

      jest.restoreAllMocks();
    });

    it('succeeds when SNYK_TOKEN is not present in the environment', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';
      delete process.env.SNYK_TOKEN;

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = execGoCommand(['depgraph']);

      mockProc.stdout.emit('data', Buffer.from('{}'));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result.exitCode).toBe(0);

      jest.restoreAllMocks();
    });

    it('streams child stderr when --debug is passed', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const stderrWriteSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation((() => true) as any);

      const promise = execGoCommand(['depgraph', '--debug']);

      mockProc.stderr.emit('data', Buffer.from('go debug log\n'));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result.stderr).toBe('go debug log\n');
      expect(stderrWriteSpy).toHaveBeenCalledWith('[go-bridge] go debug log\n');

      jest.restoreAllMocks();
    });

    it('prefixes each stderr line when streaming in debug mode', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const stderrWriteSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation((() => true) as any);

      const promise = execGoCommand(['depgraph', '--debug']);

      mockProc.stderr.emit('data', Buffer.from('line one\nline two\n'));
      mockProc.emit('close', 0);

      await promise;
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        '[go-bridge] line one\n[go-bridge] line two\n',
      );

      jest.restoreAllMocks();
    });

    it('prefixes each stderr line across chunk boundaries in debug mode', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const stderrWriteSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation((() => true) as any);

      const promise = execGoCommand(['depgraph', '--debug']);

      mockProc.stderr.emit('data', Buffer.from('line one'));
      mockProc.stderr.emit('data', Buffer.from('\nline two\nline three\n'));
      mockProc.emit('close', 0);

      await promise;
      const streamedOutput = stderrWriteSpy.mock.calls
        .map((call) => call[0] as string)
        .join('');
      expect(streamedOutput).toBe(
        '[go-bridge] line one\n[go-bridge] line two\n[go-bridge] line three\n',
      );

      jest.restoreAllMocks();
    });

    it('decodes UTF-8 stderr chunks safely in debug mode', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const stderrWriteSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation((() => true) as any);

      const promise = execGoCommand(['depgraph', '--debug']);
      const utf8Chunk = Buffer.from('🙂\n');

      mockProc.stderr.emit('data', utf8Chunk.subarray(0, 2));
      mockProc.stderr.emit('data', utf8Chunk.subarray(2));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result.stderr).toBe('🙂\n');
      expect(stderrWriteSpy).toHaveBeenCalledWith('[go-bridge] 🙂\n');

      jest.restoreAllMocks();
    });

    it('soft-caps stderr when it exceeds maximum buffer size', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      mockProc.kill = jest.fn() as any;
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const abridgeErrorMessageSpy = jest
        .spyOn(errorFormat, 'abridgeErrorMessage')
        .mockReturnValue('truncated stderr');
      jest.spyOn(Buffer, 'byteLength').mockReturnValueOnce(50 * 1024 * 1024 + 1);

      const promise = execGoCommand(['depgraph']);

      mockProc.stderr.emit('data', Buffer.from('too much stderr output'));
      mockProc.emit('close', 0);

      const result: GoCommandResult = await promise;
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('truncated stderr');
      expect(mockProc.kill).not.toHaveBeenCalled();
      expect(abridgeErrorMessageSpy).toHaveBeenCalledWith(
        expect.any(String),
        50 * 1024 * 1024,
        expect.stringContaining('stderr truncated'),
      );

      jest.restoreAllMocks();
    });

    it('does not stream child stderr without --debug', async () => {
      process.env.SNYK_INTERNAL_CLI_EXECUTABLE_PATH = '/usr/local/bin/snyk';

      const mockProc = createMockProcess();
      jest.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);
      const stderrWriteSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation((() => true) as any);

      const promise = execGoCommand(['depgraph']);

      mockProc.stderr.emit('data', Buffer.from('hidden debug log\n'));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result.stderr).toBe('hidden debug log\n');
      expect(stderrWriteSpy).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});

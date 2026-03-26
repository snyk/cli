import { DepGraphData } from '@snyk/dep-graph';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from '../../errors';
import { inspect } from './index';
import * as goBridge from '../../go-bridge';

const MOCK_DEP_GRAPH_DATA: DepGraphData = {
  schemaVersion: '1.3.0',
  pkgManager: {
    name: 'bun',
  },
  pkgs: [
    {
      id: 'my-app@1.0.0',
      info: { name: 'my-app', version: '1.0.0' },
    },
    {
      id: 'lodash@4.17.21',
      info: { name: 'lodash', version: '4.17.21' },
    },
    {
      id: 'express@4.18.2',
      info: { name: 'express', version: '4.18.2' },
    },
  ],
  graph: {
    rootNodeId: 'my-app@1.0.0',
    nodes: [
      {
        nodeId: 'my-app@1.0.0',
        pkgId: 'my-app@1.0.0',
        deps: [{ nodeId: 'lodash@4.17.21' }, { nodeId: 'express@4.18.2' }],
      },
      {
        nodeId: 'lodash@4.17.21',
        pkgId: 'lodash@4.17.21',
        deps: [],
      },
      {
        nodeId: 'express@4.18.2',
        pkgId: 'express@4.18.2',
        deps: [],
      },
    ],
  },
};

function mockResult(
  stdout: string,
  exitCode = 0,
  stderr = '',
): goBridge.GoCommandResult {
  return { exitCode, stdout, stderr };
}

describe('bun plugin', () => {
  let execGoCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    execGoCommandSpy = jest
      .spyOn(goBridge, 'execGoCommand')
      .mockResolvedValue(mockResult(JSON.stringify(MOCK_DEP_GRAPH_DATA)));
  });

  afterEach(() => {
    execGoCommandSpy.mockRestore();
  });

  it('returns a valid result with the expected depGraph', async () => {
    const result = await inspect('.', 'bun.lock');

    expect(result.plugin).toEqual({
      name: 'snyk-bun-plugin',
      packageManager: 'bun',
      targetFile: 'package.json',
    });
    expect(result.scannedProjects).toHaveLength(1);

    const { depGraph } = result.scannedProjects[0];
    expect(depGraph).toBeDefined();
    expect(depGraph!.rootPkg).toEqual({
      name: 'my-app',
      version: '1.0.0',
    });
    expect(depGraph!.pkgManager.name).toBe('bun');

    const depNames = depGraph!
      .getDepPkgs()
      .map((p) => p.name)
      .sort();
    expect(depNames).toEqual(['express', 'lodash']);
  });

  it('maps bun.lock to package.json for monitor target file', async () => {
    const result = await inspect('.', 'path/to/bun.lock');

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      ['depgraph', '--file=path/to/bun.lock', '--use-sbom-resolution', '--json'],
      { cwd: '.' },
    );
    expect(result.scannedProjects[0].targetFile).toBe('path/to/package.json');
  });

  it('passes through org when provided in options', async () => {
    await inspect('.', 'bun.lock', { org: 'my-org' } as any);

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      [
        'depgraph',
        '--file=bun.lock',
        '--use-sbom-resolution',
        '--json',
        '--org=my-org',
      ],
      { cwd: '.' },
    );
  });

  it('passes through debug and dev flags when provided in options', async () => {
    await inspect('.', 'bun.lock', { debug: true, dev: true } as any);

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      [
        'depgraph',
        '--file=bun.lock',
        '--use-sbom-resolution',
        '--json',
        '--debug',
        '--dev',
      ],
      { cwd: '.' },
    );
  });

  it('passes through strict-out-of-sync=true when provided in options', async () => {
    await inspect('.', 'bun.lock', { strictOutOfSync: true } as any);

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      [
        'depgraph',
        '--file=bun.lock',
        '--use-sbom-resolution',
        '--json',
        '--strict-out-of-sync=true',
      ],
      { cwd: '.' },
    );
  });

  it('passes through strict-out-of-sync=false when provided in options', async () => {
    await inspect('.', 'bun.lock', { strictOutOfSync: false } as any);

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      [
        'depgraph',
        '--file=bun.lock',
        '--use-sbom-resolution',
        '--json',
        '--strict-out-of-sync=false',
      ],
      { cwd: '.' },
    );
  });

  it('throws when dependency data is invalid JSON', async () => {
    execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json'));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    expect(err.userMessage).toBe('Unable to process dependency information');
    expect(err.message).toBe('Unable to process dependency information');
  });

  it('throws a generic error when command fails without parseable details', async () => {
    execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json', 1, ''));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    expect(err.userMessage).toBe('Unable to process dependency information');
    expect(err.message).toBe('Unable to process dependency information');
  });

  it('throws with the error detail from JSON stdout when command fails', async () => {
    const jsonError = JSON.stringify({
      ok: false,
      error: 'bun version 1.0.0 is not supported. Minimum required version is 1.1.0',
      path: '/test',
    });
    execGoCommandSpy.mockResolvedValueOnce(mockResult(jsonError, 2));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    expect(err.userMessage).toBe(
      'bun version 1.0.0 is not supported. Minimum required version is 1.1.0',
    );
    expect(err.message).toBe(
      'bun version 1.0.0 is not supported. Minimum required version is 1.1.0',
    );
  });

  it('throws with stderr when command fails and stdout is not JSON', async () => {
    execGoCommandSpy.mockResolvedValueOnce(
      mockResult('', 1, 'something went wrong'),
    );

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    expect(err.userMessage).toBe('something went wrong');
    expect(err.message).toBe('something went wrong');
  });

  it('extracts error message from JSON in stderr when stdout is empty', async () => {
    const stderrJson = JSON.stringify({
      ok: false,
      error: 'bun.lock is out of sync with package.json. Run `bun install` to update the lockfile.',
      path: '/test',
    });
    execGoCommandSpy.mockResolvedValueOnce(mockResult('', 2, stderrJson));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    expect(err.userMessage).toBe(
      'bun.lock is out of sync with package.json. Run `bun install` to update the lockfile.',
    );
    expect(err.message).toBe(
      'bun.lock is out of sync with package.json. Run `bun install` to update the lockfile.',
    );
  });

  it('attaches an error catalog entry for IPC propagation', async () => {
    const jsonError = JSON.stringify({
      ok: false,
      error: 'some depgraph failure',
      path: '/test',
    });
    execGoCommandSpy.mockResolvedValueOnce(mockResult(jsonError, 2));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    expect(err).toBeInstanceOf(CustomError);
    const catalog = err.errorCatalog;
    expect(catalog).toBeInstanceOf(CLI.GeneralCLIFailureError);
    expect(catalog).toBeInstanceOf(ProblemError);
    expect(catalog?.detail).toBe('some depgraph failure');
  });

  it('attaches an error catalog entry for invalid JSON errors', async () => {
    execGoCommandSpy.mockResolvedValueOnce(mockResult('not-json', 0, ''));

    const err: CustomError = await inspect('.', 'bun.lock').catch((e) => e);

    const catalog = err.errorCatalog;
    expect(catalog).toBeInstanceOf(CLI.GeneralCLIFailureError);
    expect(catalog?.detail).toBe('Unable to process dependency information');
  });

  it('passes --internal-bun-workspace-packages when allProjects is true', async () => {
    const workspaceResult = JSON.stringify({
      depGraph: MOCK_DEP_GRAPH_DATA,
      targetFile: 'package.json',
    });
    execGoCommandSpy.mockResolvedValueOnce(mockResult(workspaceResult));

    await inspect('.', 'bun.lock', { allProjects: true });

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      [
        'depgraph',
        '--file=bun.lock',
        '--use-sbom-resolution',
        '--json',
        '--internal-bun-workspace-packages',
      ],
      { cwd: '.' },
    );
  });

  it('does not pass --internal-bun-workspace-packages when allProjects is false', async () => {
    await inspect('.', 'bun.lock');

    expect(execGoCommandSpy).toHaveBeenCalledWith(
      ['depgraph', '--file=bun.lock', '--use-sbom-resolution', '--json'],
      { cwd: '.' },
    );
  });

  it('handles JSONL dep graphs from bun workspace when --all-projects is true', async () => {
    const depGraphA: DepGraphData = {
      schemaVersion: '1.3.0',
      pkgManager: { name: 'bun' },
      pkgs: [{ id: 'pkg-a@1.0.0', info: { name: 'pkg-a', version: '1.0.0' } }],
      graph: {
        rootNodeId: 'pkg-a@1.0.0',
        nodes: [{ nodeId: 'pkg-a@1.0.0', pkgId: 'pkg-a@1.0.0', deps: [] }],
      },
    };
    const depGraphB: DepGraphData = {
      schemaVersion: '1.3.0',
      pkgManager: { name: 'bun' },
      pkgs: [{ id: 'pkg-b@2.0.0', info: { name: 'pkg-b', version: '2.0.0' } }],
      graph: {
        rootNodeId: 'pkg-b@2.0.0',
        nodes: [{ nodeId: 'pkg-b@2.0.0', pkgId: 'pkg-b@2.0.0', deps: [] }],
      },
    };

    const jsonl = [
      JSON.stringify({ depGraph: depGraphA, targetFile: 'package.json' }),
      JSON.stringify({
        depGraph: depGraphB,
        targetFile: 'packages/pkg-b/package.json',
      }),
    ].join('\n');

    execGoCommandSpy.mockResolvedValueOnce(mockResult(jsonl));

    const result = await inspect('.', 'bun.lock', {
      allProjects: true,
    } as any);

    expect(result.plugin).toEqual({
      name: 'snyk-bun-plugin',
      packageManager: 'bun',
      targetFile: 'package.json',
    });

    expect(result.scannedProjects).toHaveLength(2);

    const firstProject = result.scannedProjects[0];
    expect(firstProject.targetFile).toBe('package.json');
    expect(firstProject.depGraph?.rootPkg).toEqual({
      name: 'pkg-a',
      version: '1.0.0',
    });

    const secondProject = result.scannedProjects[1];
    expect(secondProject.targetFile).toBe('packages/pkg-b/package.json');
    expect(secondProject.depGraph?.rootPkg).toEqual({
      name: 'pkg-b',
      version: '2.0.0',
    });
  });

  it('handles a single dep graph object', async () => {
    const result = await inspect('.', 'bun.lock');

    expect(result.scannedProjects).toHaveLength(1);
    expect(result.scannedProjects[0].depGraph?.rootPkg).toEqual({
      name: 'my-app',
      version: '1.0.0',
    });
  });
});

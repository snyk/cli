import { execFile } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as tls from 'tls';
import { promisify } from 'util';
import { legacy } from '@snyk/dep-graph';
import { InspectResult } from '@snyk/cli-interface/legacy/plugin';
import * as nuget from 'snyk-nuget-plugin';
import * as nugetParser from 'snyk-nuget-plugin/dist/nuget-parser';
import * as dotnet from 'snyk-nuget-plugin/dist/nuget-parser/cli/dotnet';
import { inspect } from '../../../../../../src/lib/plugins/nuget';
import { convertMultiResultToMultiCustom } from '../../../../../../src/lib/plugins/convert-multi-plugin-res-to-multi-custom';
import { convertSingleResultToMultiCustom } from '../../../../../../src/lib/plugins/convert-single-splugin-res-to-multi-custom';
import { normalizeTargetFile } from '../../../../../../src/lib/normalize-target-file';
import { monitor } from '../../../../../../src/lib/monitor';
import { MonitorMeta } from '../../../../../../src/lib/types';
import { makeRequest } from '../../../../../../src/lib/request';
import { findAndLoadPolicy } from '../../../../../../src/lib/policy';

jest.mock('child_process', () => {
  const execFile: any = jest.fn();
  execFile[Symbol.for('nodejs.util.promisify.custom')] = jest.fn();
  return { ...jest.requireActual('child_process'), execFile };
});
jest.mock('../../../../../../src/lib', () => ({
  config: { isMaster: false },
}));
jest.mock('../../../../../../src/lib/api-token', () => ({
  apiOrOAuthTokenExists: jest.fn(),
  getAuthHeader: () => 'mock-token',
}));
jest.mock('../../../../../../src/lib/request', () => ({
  makeRequest: jest.fn(),
}));
jest.mock('../../../../../../src/lib/project-metadata', () => ({
  getInfo: async () => ({
    remoteUrl: 'https://example.invalid/repository',
    branch: 'main',
  }),
}));
jest.mock('../../../../../../src/lib/policy', () => ({
  findAndLoadPolicy: jest.fn(),
}));
jest.mock('../../../../../../src/lib/analytics', () => ({ add: jest.fn() }));

const execute = (execFile as any)[promisify.custom] as jest.Mock;
const framework = '.NETFramework,Version=v4.8';
const items = {
  PackageReference: [],
  ProjectReference: [],
  PackageDownload: [],
  DotNetCliToolReference: [],
  FrameworkReference: [],
};

function convert(result: InspectResult) {
  return 'scannedProjects' in result
    ? convertMultiResultToMultiCustom(result, 'nuget')
    : convertSingleResultToMultiCustom(result, 'nuget');
}

describe('empty classic project identity', () => {
  let root: string;
  let evaluations: Record<string, any>;
  let graphFrameworks: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-identity-'));
    evaluations = {};
    graphFrameworks = {};
    // No monitor can reach a socket, even if the request mock stops matching.
    const blocked = () => {
      throw new Error('Network forbidden in monitor identity tests');
    };
    jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(blocked);
    jest.spyOn(tls, 'connect').mockImplementation(blocked);
    jest.spyOn(http, 'request').mockImplementation(blocked);
    jest.spyOn(https, 'request').mockImplementation(blocked);
    if ((global as any).fetch) {
      jest.spyOn(global as any, 'fetch').mockImplementation(blocked);
    }
    (makeRequest as jest.Mock).mockResolvedValue({
      res: { statusCode: 201, headers: {} },
      body: { ok: true, id: 'mock-project' },
    });
    jest.spyOn(dotnet, 'isInstalled').mockResolvedValue(true);
    // Runtime extraction is stubbed to avoid restore/build. Plugin selection and
    // monitor payloads remain real; runtime assembly resolution is not covered.
    jest
      .spyOn(nugetParser, 'buildDepGraphFromFiles')
      .mockImplementation(
        async (scanRoot, file, manifestType, assetsName, prefix) => {
          const tree = await nugetParser.buildDepTreeFromFiles(
            scanRoot,
            file,
            undefined,
            manifestType,
            assetsName,
            prefix,
          );
          return [
            {
              dependencyGraph: await legacy.depTreeToGraph(tree, 'nuget'),
              targetFramework: 'net48',
            },
          ];
        },
      );
    execute.mockImplementation(async (_command, args) => {
      const project = args[1];
      if (!evaluations[project]) throw new Error('Unknown project');
      const target = args.find((arg) => arg.startsWith('-getTargetResult:'));
      return {
        stdout: JSON.stringify(
          target
            ? {
                Items: items,
                TargetResults: {
                  [target.split(':')[1]]: {
                    Result: 'Success',
                    Items: [
                      {
                        Type: 'ProjectSpec',
                        ProjectStyle: 'Unknown',
                        ProjectPath: project,
                        ProjectUniqueName: project,
                        ProjectName: path.basename(
                          project,
                          path.extname(project),
                        ),
                        TargetFrameworks:
                          graphFrameworks[project] ||
                          `${evaluations[project].TargetFrameworkIdentifier},Version=${evaluations[project].TargetFrameworkVersion}`,
                      },
                    ],
                  },
                },
              }
            : { Properties: evaluations[project] },
        ),
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function projectFile(
    extension = 'csproj',
    filename = `Example.${extension}`,
  ) {
    const project = path.join(root, filename);
    fs.writeFileSync(
      project,
      '<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup></Project>',
    );
    evaluations[project] = {
      MSBuildProjectFullPath: project,
      UsingMicrosoftNETSdk: '',
      TargetFrameworkIdentifier: '.NETFramework',
      TargetFrameworkVersion: 'v4.8',
      TargetFrameworks: '',
      RestoreProjectStyle: '',
      ProjectAssetsFile: '',
      MSBuildProjectExtensionsPath: path.join(root, 'obj'),
      PackageId: '',
      AssemblyName: 'AssemblyName',
      PackageVersion: '',
      Version: '',
    };
    return project;
  }

  function writeAssets(project: string, assets: string, packageCount: number) {
    const properties = evaluations[project];
    fs.mkdirSync(path.dirname(assets), { recursive: true });
    // Synthetic restored metadata exercises the real static NuGet parser, not restore.
    fs.writeFileSync(
      assets,
      JSON.stringify({
        version: 3,
        targets: {
          [framework]: packageCount
            ? { 'Sample.Package/1.2.3': { type: 'package' } }
            : {},
        },
        libraries: {},
        project: {
          version: properties.PackageVersion || properties.Version || '1.0.0',
          restore: {
            projectPath: project,
            projectName:
              properties.PackageId ||
              properties.AssemblyName ||
              path.basename(project, path.extname(project)),
          },
          frameworks: {
            net48: {
              dependencies: packageCount
                ? {
                    'Sample.Package': {
                      target: 'Package',
                      version: '[1.2.3, )',
                    },
                  }
                : {},
            },
          },
        },
      }),
    );
  }

  async function snapshot(
    result: InspectResult,
    options: Record<string, any> = {},
  ) {
    const scanned = convert(result).scannedProjects[0];
    await monitor(
      root,
      {
        packageManager: 'nuget',
        method: 'cli',
        ...options,
        assetsProjectName: options['assets-project-name'],
      } as MonitorMeta,
      scanned,
      { path: root, ...options },
      scanned.plugin,
      path.resolve(root, normalizeTargetFile(scanned, scanned.plugin)),
    );
    const request = (makeRequest as jest.Mock).mock.calls.slice(-1)[0][0];
    return {
      request,
      identity: {
        url: request.url,
        name: request.body.meta.name,
        projectName: request.body.meta.projectName,
        targetFile: request.body.targetFile,
        targetRuntime: request.body.meta.targetRuntime,
        target: request.body.target,
      },
    };
  }

  describe.each([
    { mode: 'static', resolutionOptions: {}, runtime: false },
    {
      mode: 'explicit runtime',
      resolutionOptions: { 'dotnet-runtime-resolution': true },
      runtime: true,
    },
    {
      mode: 'implicit runtime',
      resolutionOptions: { cliDotnetRuntimeResolutionEnabled: true },
      runtime: true,
    },
    {
      mode: 'explicit static override',
      resolutionOptions: {
        cliDotnetRuntimeResolutionEnabled: true,
        'dotnet-runtime-resolution': false,
      },
      runtime: false,
    },
  ])('$mode', ({ resolutionOptions, runtime }) => {
    describe.each(['csproj', 'vbproj', 'fsproj'])('%s', (extension) => {
      it.each([
        {
          name: 'default name',
          options: {},
          properties: {},
          projectName: undefined,
        },
        {
          name: 'name prefix',
          options: { 'project-name-prefix': 'prefix/' },
          properties: {},
          projectName: undefined,
        },
        {
          name: 'assets AssemblyName',
          options: { 'assets-project-name': true },
          properties: {},
          projectName: 'AssemblyName',
        },
        {
          name: 'assets PackageId',
          options: { 'assets-project-name': true },
          properties: { PackageId: 'PackageName' },
          projectName: 'PackageName',
        },
        {
          name: 'assets project name',
          options: { 'assets-project-name': true },
          properties: { AssemblyName: '' },
          projectName: 'Example',
        },
        {
          name: 'assets name ignores prefix',
          options: {
            'assets-project-name': true,
            'project-name-prefix': 'ignored/',
          },
          properties: {},
          projectName: 'AssemblyName',
        },
        {
          name: 'explicit project name',
          options: { 'project-name': 'CustomName' },
          properties: {},
          projectName: 'CustomName',
        },
      ])(
        'keeps $name across bare, empty-assets and populated-assets snapshots',
        async ({ options, properties, projectName }) => {
          const project = projectFile(extension);
          Object.assign(evaluations[project], properties);
          const targetFile = path.basename(project);
          const assets = path.join(root, 'obj', 'project.assets.json');
          const scanOptions = { ...options, ...resolutionOptions };

          const bare = await inspect(root, targetFile, scanOptions as any);
          const before = await snapshot(bare, scanOptions);

          expect(before.identity.targetFile).toBe(
            path.join('obj', 'project.assets.json'),
          );
          expect(before.identity.targetRuntime).toBe(
            runtime ? 'net48' : undefined,
          );
          expect(before.request.body.meta.projectName).toBe(
            runtime && options['assets-project-name'] ? undefined : projectName,
          );
          expect(before.identity.url).toMatch(
            runtime ? /\/monitor\/nuget\/graph$/ : /\/monitor\/nuget$/,
          );
          expect(before.request.body.targetFileRelativePath).toBe(project);
          expect(findAndLoadPolicy).toHaveBeenLastCalledWith(
            root,
            'nuget',
            { path: root, ...scanOptions },
            runtime ? undefined : expect.any(Object),
            root,
          );
          expect(
            normalizeTargetFile(convert(bare).scannedProjects[0], bare.plugin),
          ).toBe(targetFile);
          expect(bare.plugin.targetRuntime).toBe(runtime ? undefined : 'net48');
          expect(fs.existsSync(assets)).toBe(false);
          const scanned = convert(bare).scannedProjects[0];
          const emptyGraph =
            scanned.depGraph ||
            (await legacy.depTreeToGraph(scanned.depTree!, 'nuget'));
          expect(emptyGraph.getDepPkgs()).toEqual([]);

          for (const count of [0, 1]) {
            writeAssets(project, assets, count);
            const existing = await nuget.inspect(
              root,
              path.relative(root, assets),
              scanOptions,
            );
            const after = await snapshot(existing, scanOptions);

            expect(after.identity).toEqual(before.identity);
            expect(after.request.body.meta.version).toBe(
              before.request.body.meta.version,
            );
            const scannedExisting = convert(existing).scannedProjects[0];
            expect(
              scannedExisting.depGraph
                ? scannedExisting.depGraph.getDepPkgs()
                : Object.keys(scannedExisting.depTree!.dependencies || {}),
            ).toHaveLength(count);
          }
        },
      );
    });
  });

  it.each([
    ['ProjectAssetsFile', 'build/intermediate/project.assets.json'],
    ['MSBuildProjectExtensionsPath', 'build/intermediate'],
  ])(
    'uses evaluated %s for custom in-tree output',
    async (property, output) => {
      const project = projectFile();
      evaluations[project][property] = output;

      const result = await inspect(root, path.basename(project));

      expect(result.plugin.targetFile).toBe(
        path.join('build', 'intermediate', 'project.assets.json'),
      );
      expect(fs.readdirSync(root)).toEqual(['Example.csproj']);
    },
  );

  it.each([
    { name: 'default version', properties: {}, version: '1.0.0' },
    { name: 'Version', properties: { Version: '2.0.0' }, version: '2.0.0' },
    {
      name: 'PackageVersion',
      properties: { Version: '2.0.0', PackageVersion: '3.0.0' },
      version: '3.0.0',
    },
  ])('matches NuGet $name', async ({ properties, version }) => {
    const project = projectFile();
    Object.assign(evaluations[project], properties);

    const result = await inspect(root, path.basename(project));

    expect(convert(result).scannedProjects[0].depTree!.version).toBe(version);
  });

  it.each([
    'shared output',
    'case-only output',
    'unknown sibling',
    'external sibling output',
  ])('rejects ambiguous siblings: %s', async (scenario) => {
    const project = projectFile();
    const sibling = projectFile('vbproj', 'Other.vbproj');
    if (scenario === 'case-only output') {
      evaluations[project].MSBuildProjectExtensionsPath = path.join(
        root,
        'obj',
        'Example',
      );
      evaluations[sibling].MSBuildProjectExtensionsPath = path.join(
        root,
        'obj',
        'example',
      );
    }
    if (scenario === 'unknown sibling') delete evaluations[sibling];
    if (scenario === 'external sibling output')
      evaluations[sibling].MSBuildProjectExtensionsPath = '../shared';

    await expect(inspect(root, path.basename(project))).rejects.toThrow(
      'unique legacy NuGet monitor identity',
    );
    expect(makeRequest).not.toHaveBeenCalled();
  });

  it('allows mixed-language siblings with distinct evaluated outputs', async () => {
    const projects = ['csproj', 'vbproj', 'fsproj'].map((extension) => {
      const project = projectFile(extension);
      evaluations[project].MSBuildProjectExtensionsPath = path.join(
        root,
        'obj',
        extension,
      );
      return project;
    });

    const results = await Promise.all(
      projects.map((project) => inspect(root, path.basename(project))),
    );

    expect(results.map((result) => result.plugin.targetFile)).toEqual(
      ['csproj', 'vbproj', 'fsproj'].map((extension) =>
        path.join('obj', extension, 'project.assets.json'),
      ),
    );
    expect(fs.readdirSync(root).sort()).toEqual(
      projects.map((project) => path.basename(project)).sort(),
    );
  });

  it.each([
    'missing path',
    'external path',
    'wrong filename',
    'nested project',
    'symlinked output',
  ])('rejects an unverified assets identity: %s', async (scenario) => {
    const project = projectFile();
    if (scenario === 'missing path')
      evaluations[project].MSBuildProjectExtensionsPath = '';
    if (scenario === 'external path')
      evaluations[project].MSBuildProjectExtensionsPath = '../shared';
    if (scenario === 'wrong filename')
      evaluations[project].ProjectAssetsFile = 'custom.json';
    if (scenario === 'nested project') {
      fs.mkdirSync(path.join(root, 'obj'));
      fs.writeFileSync(path.join(root, 'obj', 'Nested.csproj'), '<Project />');
    }
    if (scenario === 'symlinked output')
      fs.symlinkSync(
        path.join(root, 'missing-output'),
        path.join(root, 'obj'),
        'junction',
      );

    await expect(inspect(root, path.basename(project))).rejects.toThrow(
      'unique legacy NuGet monitor identity',
    );
  });

  it('delegates existing assets unchanged before checking sibling outputs', async () => {
    const project = projectFile();
    const assets = path.join(root, 'obj', 'project.assets.json');
    writeAssets(project, assets, 1);
    projectFile('vbproj', 'Other.vbproj');
    const expected = await nuget.inspect(root, path.relative(root, assets), {});

    const actual = await inspect(root, path.basename(project));

    expect(actual).toEqual(expected);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a sibling output resolving to a parent named project.assets.json', async () => {
    const directory = path.join('project.assets.json', 'child');
    fs.mkdirSync(path.join(root, directory), { recursive: true });
    const project = projectFile(
      'csproj',
      path.join(directory, 'Example.csproj'),
    );
    const sibling = projectFile('vbproj', path.join(directory, 'Other.vbproj'));
    evaluations[project].MSBuildProjectExtensionsPath = path.join(
      root,
      directory,
      'obj',
    );
    evaluations[sibling].ProjectAssetsFile = '..';

    await expect(inspect(root, path.relative(root, project))).rejects.toThrow(
      'unique legacy NuGet monitor identity',
    );
  });

  it('ignores directories whose names end with a project extension', async () => {
    const project = projectFile();
    fs.mkdirSync(path.join(root, 'Folder.csproj'));

    const result = await inspect(root, path.basename(project));

    expect(result.plugin.targetFile).toBe(
      path.join('obj', 'project.assets.json'),
    );
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('does not write files while verifying an empty project', async () => {
    const project = projectFile();
    const write = jest.spyOn(fs, 'writeFileSync');
    const mkdir = jest.spyOn(fs, 'mkdirSync');

    await inspect(root, path.basename(project));

    expect(write).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(fs.readdirSync(root)).toEqual(['Example.csproj']);
  });

  describe.each([false, true])('runtime resolution: %s', (runtime) => {
    it.each([
      ['v4.0', 'net40'],
      ['v4.8', 'net48'],
      ['v4.8.1', 'net481'],
    ])('uses NuGet alias %s => %s', async (version, alias) => {
      const project = projectFile();
      evaluations[project].TargetFrameworkVersion = version;

      const result = await inspect(root, path.basename(project), {
        'dotnet-runtime-resolution': runtime,
      } as any);

      const scanned = convert(result).scannedProjects[0];
      expect(scanned.meta?.targetRuntime || result.plugin.targetRuntime).toBe(
        alias,
      );
      const request = await snapshot(result);
      expect(request.identity.targetRuntime).toBe(runtime ? alias : undefined);
    });

    it.each([
      ['v4.0.0', 'v4.0'],
      ['v4.8.0', 'v4.8'],
      ['v4.08', 'v4.8'],
      ['v4.8.00', 'v4.8'],
      ['v4.08.01', 'v4.8.1'],
    ])(
      'rejects %s when NuGet normalizes the graph to %s',
      async (version, normalized) => {
        const project = projectFile();
        evaluations[project].TargetFrameworkVersion = version;
        graphFrameworks[project] = `.NETFramework,Version=${normalized}`;

        await expect(
          inspect(root, path.basename(project), {
            'dotnet-runtime-resolution': runtime,
          } as any),
        ).rejects.toThrow('Could not verify');

        expect(makeRequest).not.toHaveBeenCalled();
      },
    );
  });
});

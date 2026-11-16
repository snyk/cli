import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as nuget from 'snyk-nuget-plugin';
import { inspect } from '../../../../../../src/lib/plugins/nuget';
import { getMultiPluginResult } from '../../../../../../src/lib/plugins/get-multi-plugin-result';
import { getSinglePluginResult } from '../../../../../../src/lib/plugins/get-single-plugin-result';
import { find } from '../../../../../../src/lib/find-files';
import {
  AUTO_DETECTABLE_FILES,
  detectPackageFile,
  detectPackageManager,
  isPathToPackageFile,
  detectPackageManagerFromFile,
} from '../../../../../../src/lib/detect';
import { updateArgs } from '../../../../../../src/lib/sln';

jest.mock('child_process', () => {
  const execFile: any = jest.fn();
  execFile[Symbol.for('nodejs.util.promisify.custom')] = jest.fn();
  return { execFile };
});
jest.mock('snyk-nuget-plugin', () => ({ inspect: jest.fn() }));
jest.mock('../../../../../../src/lib/plugins/get-single-plugin-result', () => ({
  getSinglePluginResult: jest.fn(),
}));

const execute = (execFile as any)[promisify.custom] as jest.Mock;
const items = {
  PackageReference: [],
  ProjectReference: [],
  PackageDownload: [],
  DotNetCliToolReference: [],
  FrameworkReference: [],
};

const projectTypes = ['csproj', 'vbproj', 'fsproj'];

describe.each(projectTypes)('empty classic %s', (extension) => {
  const targetFile = `Example.${extension}`;
  let root: string;
  let project: string;
  let evaluation;
  let direct;
  let graph;

  beforeEach(() => {
    jest.resetAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-empty-'));
    project = path.join(root, targetFile);
    fs.writeFileSync(project, '<Project />');
    evaluation = {
      Properties: {
        MSBuildProjectFullPath: project,
        UsingMicrosoftNETSdk: '',
        TargetFrameworkIdentifier: '.NETFramework',
        TargetFrameworkVersion: 'v4.8',
        TargetFrameworks: '',
        RestoreProjectStyle: '',
        ProjectAssetsFile: '',
        MSBuildProjectExtensionsPath: path.join(root, 'obj'),
      },
    };
    const spec = {
      Type: 'ProjectSpec',
      ProjectStyle: 'Unknown',
      ProjectPath: project,
      ProjectUniqueName: project,
      ProjectName: 'Example',
      TargetFrameworks: '.NETFramework,Version=v4.8',
    };
    direct = {
      Items: { ...items },
      TargetResults: {
        _GenerateProjectRestoreGraph: {
          Result: 'Success',
          Items: [{ ...spec }],
        },
      },
    };
    graph = {
      TargetResults: {
        _GenerateRestoreGraph: { Result: 'Success', Items: [{ ...spec }] },
      },
    };
    execute.mockImplementation(async (_command, args) => ({
      stdout: JSON.stringify(
        args.includes('-getTargetResult:_GenerateRestoreGraph')
          ? graph
          : args.includes('-getTargetResult:_GenerateProjectRestoreGraph')
            ? direct
            : evaluation,
      ),
    }));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('returns one root-only graph after both NuGet graph targets verify emptiness', async () => {
    const result = await inspect(root, targetFile);

    if (!('scannedProjects' in result))
      throw new Error('Expected a project graph');
    const depGraph = result.scannedProjects[0].depGraph;
    if (!depGraph) throw new Error('Expected a dependency graph');
    expect(result.scannedProjects).toHaveLength(1);
    expect(depGraph.getDepPkgs()).toEqual([]);
    expect(depGraph.rootPkg.name).toBe('Example');
    expect(execute).toHaveBeenCalledTimes(3);
    expect(
      execute.mock.calls.every(
        ([command, args]) =>
          command === 'dotnet' &&
          args[0] === 'msbuild' &&
          !args.some((arg) => arg.includes('RestoreProjectStyle=')),
      ),
    ).toBe(true);
    expect(nuget.inspect).not.toHaveBeenCalled();
  });

  it.each([
    ['SDK project without assets', 'UsingMicrosoftNETSdk', 'true'],
    [
      'PackageReference style without assets',
      'RestoreProjectStyle',
      'PackageReference',
    ],
    ['explicit Unknown style', 'RestoreProjectStyle', 'Unknown'],
    ['multiple frameworks', 'TargetFrameworks', 'net48;net472'],
    ['unsupported framework', 'TargetFrameworkIdentifier', '.NETCoreApp'],
    ['missing framework version', 'TargetFrameworkVersion', ''],
    [
      'wrong project identity',
      'MSBuildProjectFullPath',
      '/another/Example.csproj',
    ],
  ])('fails closed for %s', async (_name, property, value) => {
    evaluation.Properties[property] = value;

    await expect(inspect(root, targetFile)).rejects.toThrow('Could not verify');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(Object.keys(items))(
    'rejects collected %s even when style is Unknown',
    async (item) => {
      direct.Items[item] = [{ Identity: 'Injected' }];

      await expect(inspect(root, targetFile)).rejects.toThrow(
        'Could not verify',
      );
    },
  );

  it.each(['Dependency', 'ProjectReference', 'RestoreSpec', 'ProjectSpec'])(
    'rejects an additional %s in the full closure',
    async (type) => {
      graph.TargetResults._GenerateRestoreGraph.Items.push({ Type: type });

      await expect(inspect(root, targetFile)).rejects.toThrow(
        'Could not verify',
      );
    },
  );

  it.each([
    'failed target',
    'missing item collections',
    'mismatched framework',
    'no spec',
  ])('rejects %s', async (scenario) => {
    if (scenario === 'failed target')
      graph.TargetResults._GenerateRestoreGraph.Result = 'Failure';
    if (scenario === 'missing item collections') delete direct.Items;
    if (scenario === 'mismatched framework')
      direct.TargetResults._GenerateProjectRestoreGraph.Items[0].TargetFrameworks =
        'net8.0';
    if (scenario === 'no spec')
      graph.TargetResults._GenerateRestoreGraph.Items = [];

    await expect(inspect(root, targetFile)).rejects.toThrow('Could not verify');
  });

  it.each([
    'missing dotnet',
    'timeout',
    'unsupported MSBuild switch',
    'invalid JSON',
  ])('fails closed on %s', async (failure) => {
    if (failure === 'invalid JSON')
      execute.mockResolvedValue({ stdout: 'not JSON' });
    else execute.mockRejectedValue(new Error(failure));

    await expect(inspect(root, targetFile)).rejects.toThrow('MSBuild 17.8');
  });

  it.each([
    { args: ['/p:Configuration=Release'] },
    { configuration: 'Release' },
    { 'dotnet-target-framework': 'net48' },
  ])('rejects unsupported configuration %j', async (options) => {
    await expect(inspect(root, targetFile, options as any)).rejects.toThrow(
      'Could not verify',
    );
  });

  it('keeps direct packages.config scans independent of dotnet', async () => {
    fs.writeFileSync(path.join(root, 'packages.config'), '<packages />');

    await inspect(root, 'packages.config');

    expect(nuget.inspect).toHaveBeenCalledWith(root, 'packages.config', {});
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    'packages.config',
    'project.json',
    'paket.dependencies',
    'packages.Example.config',
  ])('never infers zero over %s', async (manifest) => {
    fs.writeFileSync(path.join(root, manifest), '{}');

    await expect(inspect(root, targetFile)).rejects.toThrow('Could not verify');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['matching', 'wrong owner', 'invalid'])(
    'handles existing custom-path assets: %s',
    async (scenario) => {
      const assets = path.join(root, 'custom', 'project.assets.json');
      fs.mkdirSync(path.dirname(assets));
      evaluation.Properties.ProjectAssetsFile = assets;
      fs.writeFileSync(
        assets,
        scenario === 'invalid'
          ? 'invalid'
          : JSON.stringify({
              project: {
                restore: {
                  projectPath:
                    scenario === 'matching' ? project : '/other/Example.csproj',
                },
              },
            }),
      );

      if (scenario === 'matching') {
        await inspect(root, targetFile);
        expect(nuget.inspect).toHaveBeenCalledWith(
          root,
          path.join('custom', 'project.assets.json'),
          {},
        );
      } else {
        await expect(inspect(root, targetFile)).rejects.toThrow(
          'Could not verify',
        );
      }
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['lowercase', 'uppercase'])(
    'detects %s explicit, root, solution and all-projects files',
    async (casing) => {
      const filename =
        casing === 'uppercase'
          ? `Example.${extension.toUpperCase()}`
          : targetFile;
      const filenamePath = path.join(root, filename);
      fs.renameSync(project, filenamePath);
      const solution = path.join(root, 'Example.sln');
      fs.writeFileSync(
        solution,
        `Project("{guid}") = "Example", "${filename}", "{guid}"\nEndProject`,
      );
      const options = {};
      const args = { options: { file: solution, _: ['test', options] } };

      const found = await find({ path: root, filter: AUTO_DETECTABLE_FILES });
      updateArgs(args);

      expect(isPathToPackageFile(filenamePath)).toBe(true);
      expect(detectPackageManagerFromFile(filenamePath)).toBe('nuget');
      expect(detectPackageManager(root, { file: filename })).toBe('nuget');
      expect(detectPackageManager(root, {})).toBe('nuget');
      expect(detectPackageFile(root)).toBe(filename);
      expect(found.files).toEqual([filenamePath]);
      expect(args.options._).toEqual(['test', root, options]);
    },
  );

  it('honors a filter containing only another language extension', async () => {
    const otherExtension = extension === 'csproj' ? '.vbproj' : '.csproj';

    const found = await find({ path: root, filter: [otherExtension] });

    expect(found.files).toEqual([]);
  });

  it('preserves mixed-language projects and deduplicates assets by identity', async () => {
    const otherExtension =
      projectTypes[(projectTypes.indexOf(extension) + 1) % projectTypes.length];
    const second = path.join(root, `Second.${otherExtension}`);
    fs.writeFileSync(second, '<Project />');
    const assets = path.join(root, 'custom', 'project.assets.json');
    fs.mkdirSync(path.dirname(assets));
    fs.writeFileSync(
      assets,
      JSON.stringify({ project: { restore: { projectPath: project } } }),
    );

    const result = await find({ path: root, filter: AUTO_DETECTABLE_FILES });

    expect(result.files.sort()).toEqual([assets, second].sort());
    expect(detectPackageFile(root)).toBeUndefined();
  });

  it.each([
    'obj/project.assets.json',
    'project.assets.json',
    'packages.config',
  ])('prefers existing %s metadata over the root project', (manifest) => {
    const file = path.join(root, manifest);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}');

    const detected = detectPackageFile(root);

    expect(detected).toBe(manifest);
    expect(detectPackageManager(root, {})).toBe('nuget');
  });

  it('respects project exclusions', async () => {
    const result = await find({
      path: root,
      filter: AUTO_DETECTABLE_FILES,
      excludePaths: [project],
    });

    expect(result.files).toEqual([]);
  });

  it('keeps legacy metadata directories outside automatic fallback, including shared directories', async () => {
    fs.writeFileSync(path.join(root, `Second.${extension}`), '<Project />');
    fs.writeFileSync(path.join(root, 'packages.config'), '<packages />');

    const result = await find({ path: root, filter: AUTO_DETECTABLE_FILES });

    expect(result.files).toEqual([path.join(root, 'packages.config')]);
    await expect(inspect(root, `Second.${extension}`)).rejects.toThrow(
      'Could not verify',
    );
    expect(execute).not.toHaveBeenCalled();
    expect(nuget.inspect).not.toHaveBeenCalled();
  });

  it('rejects custom configuration before selecting default assets', async () => {
    const assets = path.join(root, 'obj', 'project.assets.json');
    fs.mkdirSync(path.dirname(assets));
    fs.writeFileSync(
      assets,
      JSON.stringify({ project: { restore: { projectPath: project } } }),
    );

    await expect(
      inspect(root, targetFile, {
        args: ['/p:Configuration=Release'],
      } as any),
    ).rejects.toThrow('Could not verify');
    expect(execute).not.toHaveBeenCalled();
    expect(nuget.inspect).not.toHaveBeenCalled();
  });

  it('does not hide an unrestored project behind a successful all-projects result', async () => {
    const empty = await inspect(root, targetFile);
    (getSinglePluginResult as jest.Mock)
      .mockResolvedValueOnce(empty)
      .mockRejectedValueOnce(new Error('Missing restored NuGet metadata'));

    await expect(
      getMultiPluginResult(root, { allProjects: true } as any, [
        project,
        path.join(root, `Unrestored.${extension.toUpperCase()}`),
      ]),
    ).rejects.toThrow('Missing restored NuGet metadata');
  });
});

describe('unsupported .NET project lookalikes', () => {
  it.each([
    'Example.csproj.bak',
    'Example.vbproj.user',
    'Example.fsprojx',
    'Example.vcxproj',
    'Example.njsproj',
    'Example.proj',
  ])('does not discover or route %s to NuGet', async (filename) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-lookalike-'));
    const file = path.join(root, filename);
    fs.writeFileSync(file, '<Project />');
    try {
      const found = await find({ path: root, filter: AUTO_DETECTABLE_FILES });

      expect(isPathToPackageFile(file)).toBe(false);
      expect(() => detectPackageManagerFromFile(file)).toThrow(
        'Could not detect package manager',
      );
      expect(detectPackageFile(root)).toBeUndefined();
      expect(found.files).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

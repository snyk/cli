import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { InspectResult } from '@snyk/cli-interface/legacy/plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as types from '../types';

const execute = promisify(execFile);
const properties = [
  'MSBuildProjectFullPath',
  'UsingMicrosoftNETSdk',
  'TargetFrameworkIdentifier',
  'TargetFrameworkVersion',
  'TargetFrameworks',
  'RestoreProjectStyle',
  'ProjectAssetsFile',
  'MSBuildProjectExtensionsPath',
];
const dependencyItems = [
  'PackageReference',
  'ProjectReference',
  'PackageDownload',
  'DotNetCliToolReference',
  'FrameworkReference',
];

function cannotVerify(project: string): Error {
  return new Error(
    `Could not verify ${project} as a dependency-free classic .NET project. ` +
      'Package-based projects require restored NuGet metadata. ' +
      'Empty-project verification requires dotnet with MSBuild 17.8 or newer and standard NuGet restore targets.',
  );
}

async function query(project: string, args: string[]) {
  try {
    const { stdout } = await execute(
      'dotnet',
      ['msbuild', project, '-nologo', ...args],
      {
        cwd: path.dirname(project),
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return JSON.parse(stdout);
  } catch {
    throw cannotVerify(project);
  }
}

function samePath(left: unknown, right: string): boolean {
  if (typeof left !== 'string' || !path.isAbsolute(left)) return false;
  const normalized = path.normalize(left);
  return process.platform === 'win32'
    ? normalized.toLowerCase() === path.normalize(right).toLowerCase()
    : normalized === path.normalize(right);
}

function emptyProjectSpec(
  output,
  target: string,
  project: string,
  framework: string,
) {
  const result = output?.TargetResults?.[target];
  const items = result?.Items;
  if (
    result?.Result !== 'Success' ||
    !Array.isArray(items) ||
    items.length !== 1
  ) {
    throw cannotVerify(project);
  }
  const spec = items[0];
  if (
    spec.Type !== 'ProjectSpec' ||
    spec.ProjectStyle !== 'Unknown' ||
    !samePath(spec.ProjectPath, project) ||
    !samePath(spec.ProjectUniqueName, project) ||
    spec.TargetFrameworks !== framework ||
    typeof spec.ProjectName !== 'string' ||
    !spec.ProjectName
  ) {
    throw cannotVerify(project);
  }
  return spec;
}

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<InspectResult> {
  if (!/\.csproj$/i.test(targetFile)) {
    return nugetPlugin.inspect(root, targetFile, options);
  }
  const project = path.resolve(root, targetFile);
  const directory = path.dirname(project);
  if ((options as any).configuration || (options as any).args?.length) {
    throw cannotVerify(project);
  }
  if (
    fs.existsSync(
      path.join(
        directory,
        `packages.${path.basename(project, path.extname(project))}.config`,
      ),
    )
  ) {
    throw cannotVerify(project);
  }
  for (const manifest of [
    'packages.config',
    'project.json',
    'paket.dependencies',
  ]) {
    if (fs.existsSync(path.join(directory, manifest)))
      throw cannotVerify(project);
  }

  const evaluation = await query(project, [
    `-getProperty:${properties.join(',')}`,
  ]);
  const evaluated = evaluation?.Properties;
  if (!samePath(evaluated?.MSBuildProjectFullPath, project))
    throw cannotVerify(project);
  const assets =
    evaluated.ProjectAssetsFile ||
    (evaluated.MSBuildProjectExtensionsPath &&
      path.join(evaluated.MSBuildProjectExtensionsPath, 'project.assets.json'));
  if (assets && fs.existsSync(path.resolve(directory, assets))) {
    const assetsPath = path.resolve(directory, assets);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    } catch {
      throw cannotVerify(project);
    }
    if (!samePath(manifest?.project?.restore?.projectPath, project))
      throw cannotVerify(project);
    return nugetPlugin.inspect(root, path.relative(root, assetsPath), options);
  }

  if (
    (options as any)['dotnet-target-framework'] ||
    evaluated.UsingMicrosoftNETSdk !== '' ||
    evaluated.TargetFrameworkIdentifier !== '.NETFramework' ||
    !/^v4\.[0-9]+(?:\.[0-9]+)?$/.test(evaluated.TargetFrameworkVersion) ||
    evaluated.TargetFrameworks !== '' ||
    evaluated.RestoreProjectStyle !== ''
  ) {
    throw cannotVerify(project);
  }
  const framework = `${evaluated.TargetFrameworkIdentifier},Version=${evaluated.TargetFrameworkVersion}`;
  // Read collected items in the same project instance; graph recursion uses child instances.
  const direct = await query(project, [
    '-getTargetResult:_GenerateProjectRestoreGraph',
    `-getItem:${dependencyItems.join(',')}`,
  ]);
  emptyProjectSpec(direct, '_GenerateProjectRestoreGraph', project, framework);
  if (
    dependencyItems.some(
      (item) =>
        !Array.isArray(direct.Items?.[item]) || direct.Items[item].length !== 0,
    )
  ) {
    throw cannotVerify(project);
  }
  // Use NuGet's complete graph as well, so project/tool restore entries cannot disappear.
  const graph = await query(project, [
    '-getTargetResult:_GenerateRestoreGraph',
  ]);
  const spec = emptyProjectSpec(
    graph,
    '_GenerateRestoreGraph',
    project,
    framework,
  );
  return {
    plugin: { name: 'snyk-nuget-plugin', targetFile },
    scannedProjects: [
      {
        targetFile,
        depGraph: new DepGraphBuilder(
          { name: 'nuget' },
          { name: spec.ProjectName },
        ).build(),
        meta: { targetRuntime: framework },
      },
    ],
  };
}

export function isProjectRepresented(
  project: string,
  manifests: string[],
): boolean {
  return manifests.some((manifest) => {
    if (path.basename(manifest) !== 'project.assets.json') return false;
    try {
      const assets = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      return samePath(assets?.project?.restore?.projectPath, project);
    } catch {
      return false;
    }
  });
}

export function hasLegacyMetadata(project: string): boolean {
  const directory = path.dirname(project);
  return fs
    .readdirSync(directory)
    .some(
      (file) =>
        ['packages.config', 'project.json', 'paket.dependencies'].includes(
          file,
        ) || /^packages\..+\.config$/i.test(file),
    );
}

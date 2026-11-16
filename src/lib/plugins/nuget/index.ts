import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { InspectResult } from '@snyk/cli-interface/legacy/plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as types from '../types';
import { isDotnetProjectFile } from '../../dotnet-project';

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
  'PackageId',
  'AssemblyName',
  'PackageVersion',
  'Version',
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

function assetsPath(evaluated, directory: string): string | undefined {
  const assets =
    evaluated.ProjectAssetsFile ||
    (evaluated.MSBuildProjectExtensionsPath &&
      path.join(evaluated.MSBuildProjectExtensionsPath, 'project.assets.json'));
  return assets ? path.resolve(directory, assets) : undefined;
}

function identityError(project: string): Error {
  return new Error(
    `Could not establish a unique legacy NuGet monitor identity for ${project}. ` +
      'Empty projects require distinct project.assets.json paths inside their project directories. ' +
      'Restore NuGet metadata for shared, external, or unverified output paths.',
  );
}

function projectFiles(directory: string): string[] {
  return fs
    .readdirSync(directory)
    .filter(
      (file) =>
        isDotnetProjectFile(file) &&
        fs.statSync(path.join(directory, file)).isFile(),
    );
}

function verifyAssetsPath(assets: string | undefined, project: string): string {
  const directory = path.dirname(project);
  if (!assets || path.basename(assets) !== 'project.assets.json')
    throw identityError(project);
  const relative = path.relative(directory, assets);
  if (
    relative === '..' ||
    path.isAbsolute(relative) ||
    relative.startsWith(`..${path.sep}`)
  )
    throw identityError(project);
  // A lexical child path can alias another project's output through a symlink.
  let ancestor = path.dirname(assets);
  while (!samePath(ancestor, directory)) {
    try {
      if (
        fs.lstatSync(ancestor).isSymbolicLink() ||
        projectFiles(ancestor).length > 0
      ) {
        throw identityError(project);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw identityError(project);
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw identityError(project);
    ancestor = parent;
  }
  return assets;
}

async function verifyUniqueAssetsPath(
  assets: string | undefined,
  project: string,
) {
  const verified = verifyAssetsPath(assets, project);
  const directory = path.dirname(project);
  for (const file of projectFiles(directory)) {
    const sibling = path.join(directory, file);
    if (samePath(sibling, project)) continue;
    let evaluation;
    try {
      evaluation = await query(sibling, [
        '-getProperty:MSBuildProjectFullPath,ProjectAssetsFile,MSBuildProjectExtensionsPath',
      ]);
    } catch {
      throw identityError(project);
    }
    if (!samePath(evaluation?.Properties?.MSBuildProjectFullPath, sibling))
      throw identityError(project);
    const siblingAssets = verifyAssetsPath(
      assetsPath(evaluation.Properties, directory),
      sibling,
    );
    // Missing output directories cannot reveal whether the filesystem folds case.
    if (siblingAssets.toLowerCase() === verified.toLowerCase())
      throw identityError(project);
  }
  return verified;
}

function legacyProjectName(
  root: string,
  assets: string,
  prefix: string,
): string {
  let name = path.basename(root || path.resolve(assets, '../../'));
  if (!name) {
    let directory = path.dirname(assets);
    if (path.basename(directory).toLowerCase() === 'obj')
      directory = path.dirname(directory);
    name = path.basename(directory);
  }
  return (prefix || '') + (name || 'root');
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
  if (!isDotnetProjectFile(targetFile)) {
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
  const assets = assetsPath(evaluated, directory);
  if (assets && fs.existsSync(assets)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(assets, 'utf8'));
    } catch {
      throw cannotVerify(project);
    }
    if (!samePath(manifest?.project?.restore?.projectPath, project))
      throw cannotVerify(project);
    return nugetPlugin.inspect(root, path.relative(root, assets), options);
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
  const identityFile = path.relative(
    root,
    await verifyUniqueAssetsPath(assets, project),
  );
  const name = (options as any)['assets-project-name']
    ? evaluated.PackageId || evaluated.AssemblyName || spec.ProjectName
    : legacyProjectName(root, assets!, (options as any)['project-name-prefix']);
  const version = evaluated.PackageVersion || evaluated.Version || '1.0.0';
  const [major, minor, patch] = evaluated.TargetFrameworkVersion.slice(1)
    .split('.')
    .map(Number);
  const targetRuntime = `net${major}${minor}${patch || ''}`;
  const runtimeResolution =
    (options as any)['dotnet-runtime-resolution'] ||
    ((options as any).cliDotnetRuntimeResolutionEnabled &&
      (options as any)['dotnet-runtime-resolution'] === undefined);
  // Match the existing assets route: tree and graph monitors differ in identity.
  const dependencies = runtimeResolution
    ? {
        depGraph: new DepGraphBuilder(
          { name: 'nuget' },
          { name, version },
        ).build(),
        meta: { targetRuntime },
      }
    : {
        depTree: {
          name,
          version,
          packageFormatVersion: 'nuget:0.0.0',
          dependencies: {},
          targetFile: identityFile,
        },
      };
  return {
    plugin: {
      name: 'snyk-nuget-plugin',
      targetFile: identityFile,
      ...(runtimeResolution ? {} : { targetRuntime }),
    },
    scannedProjects: [
      {
        targetFile,
        ...dependencies,
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

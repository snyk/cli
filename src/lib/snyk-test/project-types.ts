import { get } from 'lodash';
import * as path from 'path';

export {
  getAllSupportedManifestFiles,
  getManifestFiles,
  getDefaultManifestFile,
};

export type SupportedPackageManagers =
  | 'rubygems'
  | 'npm'
  | 'yarn'
  | 'pip'
  | 'golangdep'
  | 'govendor'
  | 'gomodules'
  | 'nuget'
  | 'paket'
  | 'composer';

export type SupportedBuildTool = 'sbt' | 'gradle' | 'maven';

export type SupportedProjectTypes =
  | SupportedPackageManagers
  | SupportedBuildTool
  | 'docker';
export type SupportedProjectTypesWithManifest =
  | SupportedPackageManagers
  | SupportedBuildTool;

interface PackageManagersConfig {
  manifestFiles: string[];
  defaultManifestFile?: string;
}

const PROJECT_TYPES_WITH_MANIFEST: {
  readonly [packageManager in SupportedProjectTypesWithManifest]: PackageManagersConfig;
} = {
  npm: {
    manifestFiles: ['package.json', 'package-lock.json'],
    defaultManifestFile: 'package.json',
  },
  rubygems: {
    manifestFiles: ['Gemfile', 'Gemfile.lock'],
    defaultManifestFile: 'Gemfile.lock',
  },
  yarn: {
    manifestFiles: ['package.json', 'yarn.lock'],
    defaultManifestFile: 'package.json',
  },
  maven: {
    manifestFiles: ['pom.xml'],
    defaultManifestFile: 'pom.xml',
  },
  gradle: {
    manifestFiles: ['build.gradle', 'build.gradle.kts'],
    defaultManifestFile: 'build.gradle',
  },
  sbt: {
    manifestFiles: ['build.sbt'],
    defaultManifestFile: 'build.sbt',
  },
  pip: {
    manifestFiles: ['requirements.txt', 'Pipfile'],
    defaultManifestFile: 'requirements.txt',
  },
  golangdep: {
    manifestFiles: ['Gopkg.lock'],
    defaultManifestFile: 'Gopkg.lock',
  },
  govendor: {
    manifestFiles: ['vendor.json'],
    defaultManifestFile: 'vendor.json',
  },
  gomodules: {
    manifestFiles: ['go.mod'],
    defaultManifestFile: 'go.mod',
  },
  nuget: {
    manifestFiles: [
      'packages.config',
      'project.json',
      'project.assets.json',
      // '*.csproj',
      // '*.fsproj',
      // '*.vbproj',
    ],
  },
  paket: {
    manifestFiles: ['paket.dependencies', 'paket.lock'],
    defaultManifestFile: 'paket.dependencies',
  },
  composer: {
    manifestFiles: ['composer.lock'],
    defaultManifestFile: 'composer.lock',
  },
};

function getManifestFiles(packageManager: string): string[] {
  return get(
    PROJECT_TYPES_WITH_MANIFEST,
    [packageManager, 'manifestFiles'],
    [],
  );
}

function getDefaultManifestFile(packageManager: string): string | null {
  return get(
    PROJECT_TYPES_WITH_MANIFEST,
    [packageManager, 'defaultManifestFile'],
    null,
  );
}

export function getPackageManager(targetFile: string): string {
  const cleanTargetFile = path.parse(targetFile).base;

  if (['Gemfile', 'Gemfile.lock'].includes(cleanTargetFile)) {
    return 'rubygems';
  } else if (['package.json', 'package-lock.json'].includes(cleanTargetFile)) {
    return 'npm';
  }
  return 'npm';
}

function getAllSupportedManifestFiles(
    packageManagers?: SupportedPackageManagers[],
): string[] {
    const projectTypes = Object.entries(PROJECT_TYPES_WITH_MANIFEST);
    const manifestFilesSet: Set<string> = new Set();
    const manifestFiles: Set<string> = projectTypes.reduce((manifests, [, data]) => {
      for (const file of data.manifestFiles) {
        manifests.add(file);
      }
      return manifests;
    }, manifestFilesSet);
    return Array.from(manifestFiles);
}

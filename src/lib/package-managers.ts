export const PNPM_FEATURE_FLAG = 'enablePnpmCli';
export const UV_FEATURE_FLAG = 'enableUvCLI';
export const DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG =
  'useImprovedDotnetWithoutPublish';
export const MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF =
  'enableMavenDverboseExhaustiveDeps';

export type SupportedPackageManagers =
  | 'rubygems'
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'maven'
  | 'pip'
  | 'sbt'
  | 'gradle'
  | 'golangdep'
  | 'gomodules'
  | 'nuget'
  | 'paket'
  | 'composer'
  | 'cocoapods'
  | 'poetry'
  | 'hex'
  | 'Unmanaged (C/C++)'
  | 'swift'
  | 'uv';

export enum SUPPORTED_MANIFEST_FILES {
  GEMFILE = 'Gemfile',
  GEMFILE_LOCK = 'Gemfile.lock',
  GEMSPEC = '.gemspec',
  PACKAGE_LOCK_JSON = 'package-lock.json',
  POM_XML = 'pom.xml',
  JAR = '.jar',
  WAR = '.war',
  BUILD_GRADLE = 'build.gradle',
  BUILD_GRADLE_KTS = 'build.gradle.kts',
  BUILD_SBT = 'build.sbt',
  YARN_LOCK = 'yarn.lock',
  PNPM_LOCK = 'pnpm-lock.yaml',
  PACKAGE_JSON = 'package.json',
  PIPFILE = 'Pipfile',
  SETUP_PY = 'setup.py',
  REQUIREMENTS_TXT = 'requirements.txt',
  GOPKG_LOCK = 'Gopkg.lock',
  GO_MOD = 'go.mod',
  PROJECT_ASSETS_JSON = 'project.assets.json',
  PACKAGES_CONFIG = 'packages.config',
  PROJECT_JSON = 'project.json',
  PAKET_DEPENDENCIES = 'paket.dependencies',
  COMPOSER_LOCK = 'composer.lock',
  PODFILE_LOCK = 'Podfile.lock',
  COCOAPODS_PODFILE_YAML = 'CocoaPods.podfile.yaml',
  COCOAPODS_PODFILE = 'CocoaPods.podfile',
  PODFILE = 'Podfile',
  POETRY_LOCK = 'poetry.lock',
  MIX_EXS = 'mix.exs',
  PACKAGE_SWIFT = 'Package.swift',
  UV_LOCK = 'uv.lock',
}

export const SUPPORTED_PACKAGE_MANAGER_NAME: {
  readonly [packageManager in SupportedPackageManagers]: string;
} = {
  rubygems: 'RubyGems',
  npm: 'npm',
  yarn: 'Yarn',
  pnpm: 'pnpm',
  maven: 'Maven',
  pip: 'pip',
  sbt: 'SBT',
  gradle: 'Gradle',
  golangdep: 'dep (Go)',
  gomodules: 'Go Modules',
  nuget: 'NuGet',
  paket: 'Paket',
  composer: 'Composer',
  cocoapods: 'CocoaPods',
  poetry: 'Poetry',
  hex: 'Hex',
  'Unmanaged (C/C++)': 'Unmanaged (C/C++)',
  swift: 'Swift',
  uv: 'uv',
};

export const GRAPH_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'npm',
  'sbt',
  'yarn',
  'rubygems',
  'poetry',
  'cocoapods',
];
// For ecosystems with a flat set of libraries (e.g. Python, JVM), one can
// "pin" a transitive dependency
export const PINNING_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'pip',
];

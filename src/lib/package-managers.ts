export type SupportedPackageManagers =
  | 'rubygems'
  | 'npm'
  | 'yarn'
  | 'maven'
  | 'pip'
  | 'sbt'
  | 'gradle'
  | 'golangdep'
  | 'govendor'
  | 'gomodules'
  | 'nuget'
  | 'paket'
  | 'composer'
  | 'cocoapods'
  | 'poetry'
  | 'hex';

export const SUPPORTED_PACKAGE_MANAGER_NAME: {
  readonly [packageManager in SupportedPackageManagers]: string;
} = {
  rubygems: 'RubyGems',
  npm: 'npm',
  yarn: 'Yarn',
  maven: 'Maven',
  pip: 'pip',
  sbt: 'SBT',
  gradle: 'Gradle',
  golangdep: 'dep (Go)',
  gomodules: 'Go Modules',
  govendor: 'govendor',
  nuget: 'NuGet',
  paket: 'Paket',
  composer: 'Composer',
  cocoapods: 'CocoaPods',
  poetry: 'Poetry',
  hex: 'Hex',
};

export const WIZARD_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'yarn',
  'npm',
];
export const PROTECT_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'yarn',
  'npm',
];
export const GRAPH_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'npm',
  'sbt',
  'yarn',
  'rubygems',
  'poetry',
];
// For ecosystems with a flat set of libraries (e.g. Python, JVM), one can
// "pin" a transitive dependency
export const PINNING_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'pip',
];
export const REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[] = [
  'maven',
  'gradle',
];

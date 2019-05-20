export type SupportedPackageManagers = 'rubygems' | 'npm' | 'yarn' |
'maven' | 'pip' | 'sbt' | 'gradle' | 'golangdep' | 'govendor' |
'nuget' | 'paket' | 'composer';

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
  govendor: 'govendor',
  nuget: 'NuGet',
  paket: 'Paket',
  composer: 'Composer',
};

export const WIZARD_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[]
  = ['yarn', 'npm'];
export const PROTECT_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[]
  = ['yarn', 'npm'];

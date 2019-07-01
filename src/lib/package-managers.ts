import { SupportedPackageManagers } from '@snyk/cli-interface/dist/legacy/common';

export { SupportedPackageManagers };

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

  // Docker
  rpm: 'rpm (Linux)',
  deb: 'deb (Linux)',
  apk: 'apk (Linux)',
  dockerfile: 'Dockerfile',
};

export const WIZARD_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[]
  = ['yarn', 'npm'];
export const PROTECT_SUPPORTED_PACKAGE_MANAGERS: SupportedPackageManagers[]
  = ['yarn', 'npm'];

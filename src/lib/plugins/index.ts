import * as rubygemsPlugin from './rubygems';
import * as mvnPlugin from 'snyk-mvn-plugin';
import * as gradlePlugin from 'snyk-gradle-plugin';
import * as sbtPlugin from 'snyk-sbt-plugin';
import * as pythonPlugin from 'snyk-python-plugin';
import * as goPlugin from 'snyk-go-plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as phpPlugin from 'snyk-php-plugin';
import * as nodejsPlugin from './nodejs-plugin';
import * as cocoapodsPlugin from '@snyk/snyk-cocoapods-plugin';
import * as hexPlugin from '@snyk/snyk-hex-plugin';
import * as types from './types';
import { SupportedPackageManagers } from '../package-managers';
import { UnsupportedPackageManagerError } from '../errors';

export function loadPlugin(
  packageManager: SupportedPackageManagers | undefined,
): types.Plugin {
  switch (packageManager) {
    case 'npm': {
      return nodejsPlugin;
    }
    case 'rubygems': {
      return rubygemsPlugin;
    }
    case 'maven': {
      return mvnPlugin;
    }
    case 'gradle': {
      return gradlePlugin;
    }
    case 'sbt': {
      return sbtPlugin;
    }
    case 'yarn': {
      return nodejsPlugin;
    }
    case 'pip':
    case 'poetry': {
      return pythonPlugin;
    }
    case 'golangdep':
    case 'gomodules':
    case 'govendor': {
      return goPlugin;
    }
    case 'nuget': {
      return nugetPlugin;
    }
    case 'paket': {
      return nugetPlugin;
    }
    case 'composer': {
      return phpPlugin;
    }
    case 'cocoapods': {
      return cocoapodsPlugin;
    }
    case 'hex': {
      return hexPlugin;
    }
    default: {
      throw new UnsupportedPackageManagerError(packageManager);
    }
  }
}

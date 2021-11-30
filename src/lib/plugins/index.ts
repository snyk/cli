import * as rubygemsPlugin from './rubygems';
import mvnPlugin from 'snyk-mvn-plugin';
import gradlePlugin from 'snyk-gradle-plugin';
import sbtPlugin from 'snyk-sbt-plugin';
import pythonPlugin from 'snyk-python-plugin';
import goPlugin from 'snyk-go-plugin';
import nugetPlugin from 'snyk-nuget-plugin';
import phpPlugin from 'snyk-php-plugin';
import * as nodejsPlugin from './nodejs-plugin';
import cocoapodsPlugin from '@snyk/snyk-cocoapods-plugin';
import hexPlugin from '@snyk/snyk-hex-plugin';
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

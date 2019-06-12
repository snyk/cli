import * as dockerPlugin from 'snyk-docker-plugin';
import * as rubygemsPlugin from './rubygems';
import * as mvnPlugin from 'snyk-mvn-plugin';
import * as gradlePlugin from 'snyk-gradle-plugin';
import * as sbtPlugin from 'snyk-sbt-plugin';
import * as pythonPlugin from 'snyk-python-plugin';
import * as goPlugin from 'snyk-go-plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as phpPlugin from 'snyk-php-plugin';
import * as nodejsPlugin from './nodejs-plugin';
import * as types from './types';
import {SupportedPackageManagers} from '../package-managers';

export function loadPlugin(packageManager: SupportedPackageManagers,
                           options: types.Options = {}): types.Plugin {
  if (options.docker) {
    return dockerPlugin;
  }

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
    case 'pip': {
      return pythonPlugin;
    }
    case 'golangdep':
    case 'gomod':
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
    default: {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }
}

export function getPluginOptions(packageManager: string, options: types.Options): types.Options {
  const pluginOptions: types.Options = {};
  switch (packageManager) {
    case 'gradle': {
      if (options['all-sub-projects']) {
        pluginOptions.multiDepRoots = true;
      }
      return pluginOptions;
    }
    default: {
      return pluginOptions;
    }
  }
}

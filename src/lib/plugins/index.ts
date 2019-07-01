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
import { Plugin, adaptSingleProjectPlugin, SingleSubprojectPlugin } from '@snyk/cli-interface/dist/legacy/plugin';

export function loadPlugin(packageManager: SupportedPackageManagers,
                           options: types.Options = {}): Plugin {
  if (options.docker) {
    return dockerPlugin;
  }

  switch (packageManager) {
    case 'npm': {
      return adaptSingleProjectPlugin(nodejsPlugin);
    }
    case 'rubygems': {
      return adaptSingleProjectPlugin(rubygemsPlugin);
    }
    case 'maven': {
      return adaptSingleProjectPlugin(mvnPlugin);
    }
    case 'gradle': {
      return gradlePlugin as any as Plugin; // TODO(kyegupov): remove the cast once gradle plugin is updated
    }
    case 'sbt': {
      return adaptSingleProjectPlugin(sbtPlugin);
    }
    case 'yarn': {
      return adaptSingleProjectPlugin(nodejsPlugin); // will become a full Plugin when Yarn Workspaces are supported
    }
    case 'pip': {
      return adaptSingleProjectPlugin(pythonPlugin);
    }
    case 'golangdep':
    case 'gomodules':
    case 'govendor': {
      // this plugin needs an updrade of the types
      return adaptSingleProjectPlugin(goPlugin as SingleSubprojectPlugin);
    }
    case 'nuget': {
      return adaptSingleProjectPlugin(nugetPlugin);
    }
    case 'paket': {
      return adaptSingleProjectPlugin(nugetPlugin);
    }
    case 'composer': {
      // this plugin needs an updrade of the types;
      return adaptSingleProjectPlugin(phpPlugin as SingleSubprojectPlugin);
    }
    default: {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }
}

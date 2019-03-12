import * as dockerPlugin from 'snyk-docker-plugin';
import * as npmPlugin from './npm';
import * as rubygemsPlugin from './rubygems';
import * as mvnPlugin from 'snyk-mvn-plugin';
import * as gradlePlugin from 'snyk-gradle-plugin';
import * as sbtPlugin from 'snyk-sbt-plugin';
import * as yarnPlugin from './yarn';
import * as pythonPlugin from 'snyk-python-plugin';
import * as goPlugin from 'snyk-go-plugin';
import * as nugetPlugin from 'snyk-nuget-plugin';
import * as phpPlugin from 'snyk-php-plugin';

interface InspectResult {
  plugin: {
    name: string;
    runtime: string;
  };
  package: any;
}

interface Options {
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean | 'true' | 'false';
}

interface Plugin {
  inspect: (root: string, targetFile: string, options?: Options) => Promise<InspectResult>;
}

export function loadPlugin(packageManager: string, options: Options = {}): Plugin {
  if (options.docker) {
    return dockerPlugin;
  }

  switch (packageManager) {
    case 'npm': {
      return npmPlugin;
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
      return yarnPlugin;
    }
    case 'pip': {
      return pythonPlugin;
    }
    case 'golangdep':
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

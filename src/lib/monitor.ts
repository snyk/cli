import * as snyk from '../lib';
import {exists as apiTokenExists} from './api-token';
import * as request from './request';
import * as config from './config';
import * as os from 'os';
import * as _ from 'lodash';
import * as isCI from './is-ci';
import * as analytics from './analytics';
import { SingleDepRootResult, MonitorError } from './types';

// TODO(kyegupov): clean up the type, move to snyk-cli-interface repository

interface MonitorBody {
  meta: Meta;
  policy: string;
  package: {}; // TODO(kyegupov): DepTree
  targetFile: string;
}

interface Meta {
  method?: string;
  hostname: string;
  id: string;
  ci: boolean;
  pid: number;
  node: string;
  master: boolean;
  name: string;
  version: string;
  org?: string;
  pluginName: string;
  pluginRuntime: string;
  dockerImageId?: string;
  dockerBaseImage?: string;
  projectName: string;
}

export function monitor(root, meta, info: SingleDepRootResult): Promise<any> {
  const pkg = info.package;
  const pluginMeta = info.plugin;
  let policyPath = meta['policy-path'];
  if (!meta.isDocker) {
    policyPath = policyPath || root;
  }
  const policyLocations = [policyPath].concat(pluckPolicies(pkg))
    .filter(Boolean);
  const opts = {loose: true};
  const packageManager = meta.packageManager || 'npm';
  return apiTokenExists('snyk monitor')
    .then(() => {
      if (policyLocations.length === 0) {
        return snyk.policy.create();
      }
      return snyk.policy.load(policyLocations, opts);
    }).then((policy) => {
      analytics.add('packageManager', packageManager);
      // TODO(kyegupov): async/await
      return new Promise((resolve, reject) => {
        request({
          body: {
            meta: {
              method: meta.method,
              hostname: os.hostname(),
              id: meta.id || snyk.id || pkg.name,
              ci: isCI,
              pid: process.pid,
              node: process.version,
              master: snyk.config.isMaster,
              name: pkg.name,
              version: pkg.version,
              org: config.org ? decodeURIComponent(config.org) : undefined,
              pluginName: pluginMeta.name,
              pluginRuntime: pluginMeta.runtime,
              dockerImageId: pluginMeta.dockerImageId,
              dockerBaseImage: pkg.docker ? pkg.docker.baseImage : undefined,
              projectName: meta['project-name'],
            },
            policy: policy.toString(),
            package: pkg,
            // we take the targetFile from the plugin,
            // because we want to send it only for specific package-managers
            targetFile: pluginMeta.targetFile,
          } as MonitorBody,
          gzip: true,
          method: 'PUT',
          headers: {
            'authorization': 'token ' + snyk.api,
            'content-encoding': 'gzip',
          },
          url: config.API + '/monitor/' + packageManager,
          json: true,
        }, (error, res, body) => {
          if (error) {
            return reject(error);
          }

          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(body);
          } else {
            const e = new MonitorError('unexpected error: ' + body.message);
            e.code = res.statusCode;
            e.userMessage = body && body.userMessage;
            if (!e.userMessage && res.statusCode === 504) {
              e.userMessage = 'Connection Timeout';
            }
            reject(e);
          }
        });
      });
    });
}

function pluckPolicies(pkg) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(Object.keys(pkg.dependencies).map((name) => {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}

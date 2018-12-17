import * as _ from 'lodash';
import fs = require('then-fs');
import pathUtil = require('path');
import moduleToObject = require('snyk-module');
import * as depGraphLib from '@snyk/dep-graph';

import analytics = require('../analytics');
import config = require('../config');
import detect = require('../../lib/detect');
import plugins = require('../plugins');
import ModuleInfo = require('../module-info');
import isCI = require('../is-ci');
import request = require('../request');
import snyk = require('../');
import spinner = require('../spinner');
import common = require('./common');
import gemfileLockToDependencies = require('../../lib/plugins/rubygems/gemfile-lock-to-dependencies');
import {convertTestDepGraphResultToLegacy} from './legacy';

// tslint:disable-next-line:no-var-requires
const debug = require('debug')('snyk');

export = runTest;

async function runTest(packageManager: string, root: string , options): Promise<object> {
  const policyLocations = [options['policy-path'] || root];
  // TODO: why hasDevDependencies is always false?
  const hasDevDependencies = false;

  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payload = await assemblePayload(root, options, policyLocations);
    const filesystemPolicy = payload.body && !!payload.body.policy;
    const depGraph = payload.body && payload.body.depGraph;

    let dockerfilePackages;
    if (payload.body && payload.body.docker && payload.body.docker.dockerfilePackages) {
      dockerfilePackages = payload.body.docker.dockerfilePackages;
    }

    await spinner(spinnerLbl);
    let res = await sendPayload(payload, hasDevDependencies);
    if (depGraph) {
      res = convertTestDepGraphResultToLegacy(
        res,
        depGraph,
        packageManager,
        options.severityThreshold);
    }

    analytics.add('vulns-pre-policy', res.vulnerabilities.length);
    res.filesystemPolicy = filesystemPolicy;
    if (!options['ignore-policy']) {
      const policy = await snyk.policy.loadFromText(res.policy);
      res = policy.filter(res, root);
    }
    analytics.add('vulns', res.vulnerabilities.length);

    // add the unique count of vulnerabilities found
    res.uniqueCount = 0;
    const seen = {};
    res.uniqueCount = res.vulnerabilities.reduce((acc, curr) => {
      if (!seen[curr.id]) {
        seen[curr.id] = true;
        acc++;
      }
      return acc;
    }, 0);

    if (res.docker && dockerfilePackages) {
      res.vulnerabilities = res.vulnerabilities.map((vuln) => {
        const dockerfilePackage = dockerfilePackages[vuln.name.split('/')[0]];
        if (dockerfilePackage) {
          vuln.dockerfileInstruction = dockerfilePackage.instruction;
        }
        vuln.dockerBaseImage = res.docker.baseImage;
        return vuln;
      });
    }

    return res;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

interface Payload {
  method: string;
  url: string;
  json: boolean;
  headers: {
    'x-is-ci': boolean;
    authorization: string;
  };
  body?: {
    depGraph: depGraphLib.DepGraph,
    policy: string;
    targetFile?: string;
    projectNameOverride?: string;
    docker?: any;
  };
  qs?: object | null;
}

function sendPayload(payload, hasDevDependencies): Promise<any> {
  const filesystemPolicy = payload.body && !!payload.body.policy;
  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      if (res.statusCode !== 200) {
        const err = new Error(body && body.error ?
          body.error :
          res.statusCode);

        (err as any).userMessage = body && body.userMessage;
        // this is the case where a local module has been tested, but
        // doesn't have any production deps, but we've noted that they
        // have dep deps, so we'll error with a more useful message
        if (res.statusCode === 404 && hasDevDependencies) {
          (err as any).code = 'NOT_FOUND_HAS_DEV_DEPS';
        } else {
          (err as any).code = res.statusCode;
        }

        if (res.statusCode === 500) {
          debug('Server error', body.stack);
        }

        return reject(err);
      }

      body.filesystemPolicy = filesystemPolicy;

      resolve(body);
    });
  });
}

function assemblePayload(root: string, options, policyLocations: string[]): Promise<Payload> {
  let isLocal;
  if (options.docker) {
    isLocal = true;
    policyLocations = policyLocations.filter((loc) => {
      return loc !== root;
    });
  } else {
    isLocal = fs.existsSync(root);
  }
  analytics.add('local', isLocal);
  if (isLocal) {
    return assembleLocalPayload(root, options, policyLocations);
  }
  return assembleRemotePayload(root, options);
}

async function assembleLocalPayload(root, options, policyLocations): Promise<Payload> {
  options.file = options.file || detect.detectPackageFile(root);
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const analysisType = options.docker ? 'docker' : options.packageManager;
  const spinnerLbl = 'Analyzing ' + analysisType + ' dependencies for ' +
    pathUtil.relative('.', pathUtil.join(root, options.file || ''));

  try {
    await spinner(spinnerLbl);
    const inspectRes = await moduleInfo.inspect(root, options.file, options);

    const pkg = inspectRes.package;
    if (_.get(inspectRes, 'plugin.packageManager')) {
      options.packageManager = inspectRes.plugin.packageManager;
    }
    if (!_.get(pkg, 'docker.baseImage') && options['base-image']) {
      pkg.docker = pkg.docker || {};
      pkg.docker.baseImage = options['base-image'];
    }

    if (_.get(pkg, 'files.gemfileLock.contents')) {
      const gemfileLockBase64 = pkg.files.gemfileLock.contents;
      const gemfileLockContents = Buffer.from(gemfileLockBase64, 'base64').toString();
      pkg.dependencies = gemfileLockToDependencies(gemfileLockContents);
    }

    const depGraph = await depGraphLib.legacy.depTreeToGraph(
      pkg, options.packageManager);

    analytics.add('policies', policyLocations.length);
    analytics.add('packageManager', options.packageManager);
    analytics.add('packageName', pkg.name);
    analytics.add('packageVersion', pkg.version);
    analytics.add('package', pkg.name + '@' + pkg.version);

    let policy;
    if (policyLocations.length > 0) {
      try {
        policy = await snyk.policy.load(policyLocations, options);
      } catch (err) {
        // note: inline catch, to handle error from .load
        //   if the .snyk file wasn't found, it is fine
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }

    const payload: Payload = {
      method: 'POST',
      url: config.API + '/test-dep-graph',
      json: true,
      headers: {
        'x-is-ci': isCI,
        'authorization': 'token ' + (snyk as any).api,
      },
      qs: common.assembleQueryString(options),
      body: {
        depGraph,
        targetFile: pkg.targetFile || options.file,
        projectNameOverride: options.projectName,
        policy: policy && policy.toString(),
        docker: pkg.docker,
      },
    };

    return payload;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

async function assembleRemotePayload(root, options): Promise<Payload> {
  const pkg = moduleToObject(root);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  analytics.add('packageName', pkg.name);
  analytics.add('packageVersion', pkg.version);
  analytics.add('packageManager', options.packageManager);
  analytics.add('package', pkg.name + '@' + pkg.version);
  const encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  const payload: Payload = {
    method: 'GET',
    url: `${config.API}/vuln/${options.packageManager}/${encodedName}`,
    json: true,
    headers: {
      'x-is-ci': isCI,
      'authorization': 'token ' + (snyk as any).api,
    },
  };
  payload.qs = common.assembleQueryString(options);
  return payload;
}

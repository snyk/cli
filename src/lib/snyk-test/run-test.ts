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
import {convertTestDepGraphResultToLegacy, AnnotatedIssue} from './legacy';

// tslint:disable-next-line:no-var-requires
const debug = require('debug')('snyk');

export = runTest;

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

interface PluginMetadata {
  name: string;
  packageFormatVersion?: string;
  packageManager: string;
  imageLayers?: any;
  targetFile?: string; // this is wrong (because Shaun said it)
}

interface DepDict {
  [name: string]: DepTree;
}

interface DepTree {
  name: string;
  version: string;
  dependencies?: DepDict;
  packageFormatVersion?: string;
  docker?: any;
  files?: any;
  targetFile?: string;
}

interface DepRoot {
  depTree: DepTree; // to be soon replaced with depGraph
  targetFile?: string;
}

interface Package {
  plugin: PluginMetadata;
  depRoots?: DepRoot[]; // currently only returned by gradle
  package?: DepTree;
}

async function runTest(packageManager: string, root: string, options): Promise<object[]> {
  const policyLocations = [options['policy-path'] || root];
  // TODO: why hasDevDependencies is always false?
  const hasDevDependencies = false;

  const results: object[] = [];
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payloads = await assemblePayload(root, options, policyLocations);
    for (const payload of payloads) {
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

      if (options.docker && options.file && options['exclude-base-image-vulns']) {
        res.vulnerabilities = res.vulnerabilities.filter((vuln) => (vuln.dockerfileInstruction));
      }

      res.uniqueCount = countUniqueVulns(res.vulnerabilities);
      results.push(res);
    }
    return results;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

function sendPayload(payload: Payload, hasDevDependencies: boolean): Promise<any> {
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

function assemblePayload(root: string, options, policyLocations: string[]): Promise<Payload[]> {
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

// Force getDepsFromPlugin to return depRoots for processing in assembleLocalPayload
interface MultiRootsPackage extends Package {
  depRoots: DepRoot[];
}

async function getDepsFromPlugin(root, options): Promise<MultiRootsPackage> {
  options.file = options.file || detect.detectPackageFile(root);
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const pluginOptions = plugins.getPluginOptions(options.packageManager, options);
  const inspectRes: Package = await moduleInfo.inspect(root, options.file, { ...options, ...pluginOptions });

  if (!inspectRes.depRoots) {
    if (!inspectRes.package) {
      // something went wrong if both are not present...
      throw Error(`error getting dependencies from ${options.packageManager} ` +
                  'plugin: neither \'package\' nor \'depRoots\' were found');
    }
    if (!inspectRes.package.targetFile && inspectRes.plugin) {
      inspectRes.package.targetFile = inspectRes.plugin.targetFile;
    }
    inspectRes.depRoots = [{depTree: inspectRes.package}];
  } else {
    options.subProjectNames = inspectRes.depRoots.map((depRoot) => depRoot.depTree.name);
  }

  return {
    depRoots: inspectRes.depRoots,
    plugin: inspectRes.plugin,
  };
}

async function assembleLocalPayload(root, options, policyLocations): Promise<Payload[]> {
  const analysisType = options.docker ? 'docker' : options.packageManager;
  const spinnerLbl = 'Analyzing ' + analysisType + ' dependencies for ' +
     (pathUtil.relative('.', pathUtil.join(root, options.file || '')) ||
       (pathUtil.relative('..', '.') + ' project dir'));

  try {
    const payloads: Payload[] = [];

    await spinner(spinnerLbl);
    const deps = await getDepsFromPlugin(root, options);

    for (const depRoot of deps.depRoots) {
      const pkg = depRoot.depTree;
      if (deps.plugin && deps.plugin.packageManager) {
        options.packageManager = deps.plugin.packageManager;
      }

      const baseImageFromDockerfile = _.get(pkg, 'docker.baseImage');
      if (!baseImageFromDockerfile && options['base-image']) {
        pkg.docker = pkg.docker || {};
        pkg.docker.baseImage = options['base-image'];
      }

      if (baseImageFromDockerfile && deps.plugin && deps.plugin.imageLayers) {
        analytics.add('BaseImage', baseImageFromDockerfile);
        analytics.add('imageLayers', deps.plugin.imageLayers);
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

      payloads.push(payload);
    }
    return payloads;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

async function assembleRemotePayload(root, options): Promise<Payload[]> {
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
  return [payload];
}

function countUniqueVulns(vulns: AnnotatedIssue[]): number {
  const seen = {};
  const count = vulns.reduce((acc, curr) => {
    if (!seen[curr.id]) {
      seen[curr.id] = true;
      acc++;
    }
    return acc;
  }, 0);

  return count;
}

module.exports = runTest;

var _ = require('lodash');
var debug = require('debug')('snyk');
var fs = require('then-fs');
var moduleToObject = require('snyk-module');
var pathUtil = require('path');

var analytics = require('../analytics');
var config = require('../config');
var detect = require('../../lib/detect');
var plugins = require('../plugins');
var ModuleInfo = require('../module-info');
var isCI = require('../is-ci');
var request = require('../request');
var snyk = require('../');
var spinner = require('../spinner');
var common = require('./common');

async function runTest(packageManager, root, options) {
  var policyLocations = [options['policy-path'] || root];
  // TODO: why hasDevDependencies is always false?
  var hasDevDependencies = false;

  var spinnerLbl = 'Querying vulnerabilities database...';

  try {
    var payload = await assemblePayload(root, options, policyLocations);
    var filesystemPolicy = payload.body && !!payload.body.policy;

    await spinner(spinnerLbl);

    var res = await sendRequest(payload, hasDevDependencies);

    analytics.add('vulns-pre-policy', res.vulnerabilities.length);
    res.filesystemPolicy = filesystemPolicy;
    if (!options['ignore-policy']) {
      var policy = await snyk.policy.loadFromText(res.policy);
      res = policy.filter(res, root);
    }
    analytics.add('vulns', res.vulnerabilities.length);

    // add the unique count of vulnerabilities found
    res.uniqueCount = 0;
    var seen = {};
    res.uniqueCount = res.vulnerabilities.reduce(function (acc, curr) {
      if (!seen[curr.id]) {
        seen[curr.id] = true;
        acc++;
      }
      return acc;
    }, 0);

    return res;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

function sendRequest(payload, hasDevDependencies) {
  return new Promise(function (resolve, reject) {
    request(payload, function (error, res, body) {
      if (error) {
        return reject(error);
      }

      if (res.statusCode !== 200) {
        var err = new Error(body && body.error ?
          body.error :
          res.statusCode);

        err.userMessage = body && body.userMessage;
        // this is the case where a local module has been tested, but
        // doesn't have any production deps, but we've noted that they
        // have dep deps, so we'll error with a more useful message
        if (res.statusCode === 404 && hasDevDependencies) {
          err.code = 'NOT_FOUND_HAS_DEV_DEPS';
        } else {
          err.code = res.statusCode;
        }

        if (res.statusCode === 500) {
          debug('Server error', body.stack);
        }

        return reject(err);
      }

      resolve(body);
    });
  });
}

function assemblePayload(root, options, policyLocations) {
  var isLocal;
  if (options.docker) {
    isLocal = true;
    policyLocations = policyLocations.filter(function (loc) {
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

async function assembleLocalPayload(root, options, policyLocations) {
  options.file = options.file || detect.detectPackageFile(root);
  var plugin = plugins.loadPlugin(options.packageManager, options);
  var moduleInfo = ModuleInfo(plugin, options.policy);
  var analysisType = options.docker ? 'docker' : options.packageManager;
  var spinnerLbl = 'Analyzing ' + analysisType + ' dependencies for ' +
    pathUtil.relative('.', pathUtil.join(root, options.file || ''));

  try {
    await spinner(spinnerLbl);
    var inspectRes = await moduleInfo.inspect(root, options.file, options);

    var pkg = inspectRes.package;
    if (_.get(inspectRes, 'plugin.packageManager')) {
      options.packageManager = inspectRes.plugin.packageManager;
    }
    if (!_.get(pkg, 'docker.baseImage') && options['base-image']) {
      pkg.docker = pkg.docker || {};
      pkg.docker.baseImage = options['base-image'];
    }
    analytics.add('policies', policyLocations.length);
    analytics.add('packageManager', options.packageManager);
    analytics.add('packageName', pkg.name);
    analytics.add('packageVersion', pkg.version);
    analytics.add('package', pkg.name + '@' + pkg.version);
    var payload = {
      method: 'POST',
      url: vulnUrl(options.packageManager),
      json: true,
      headers: {
        'x-is-ci': isCI,
        authorization: 'token ' + snyk.api,
      },
      body: pkg,
    };
    payload.qs = common.assembleQueryString(options);

    if (policyLocations.length > 0) {
      try {
        var policy = await snyk.policy.load(policyLocations, options);
        payload.body.policy = policy.toString();
      } catch (err) {
        // note: inline catch, to handle error from .load
        //   if the .snyk file wasn't found, it is fine
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }
    return payload;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

async function assembleRemotePayload(root, options) {
  var pkg = moduleToObject(root);
  var encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  analytics.add('packageName', pkg.name);
  analytics.add('packageVersion', pkg.version);
  analytics.add('packageManager', options.packageManager);
  analytics.add('package', pkg.name + '@' + pkg.version);
  var payload = {
    method: 'GET',
    url: vulnUrl(options.packageManager) + '/' + encodedName,
    json: true,
    headers: {
      'x-is-ci': isCI,
      authorization: 'token ' + snyk.api,
    },
  };
  payload.qs = common.assembleQueryString(options);
  return payload;
}

function vulnUrl(packageManager) {
  return config.API + '/vuln/' + packageManager;
}

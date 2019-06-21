const debug = require('debug')('snyk');
const snyk = require('../../../lib/');
const protect = require('../../../lib/protect');
const analytics = require('../../../lib/analytics');
const detect = require('../../../lib/detect');
const pm = require('../../../lib/package-managers');


function protectFunc(options = {}) {
  options.loose = true; // replace missing policies with empty ones
  options.vulnEndpoint = '/vuln/npm/patches';
  // TODO: fix this by providing better patch support for yarn
  // yarn hoists packages up a tree so we can't assume their location
  // on disk without traversing node_modules
  // currently the npm@2 nd npm@3 plugin resolve-deps can do this
  // but not the latest node-lockfile-parser
  // HACK: if yarn set traverseNodeModules option to
  // bypass lockfile test for wizard
  options.traverseNodeModules = true;


  try {
    const packageManager = detect.detectPackageManager(process.cwd(), options);
    const supportsProtect = pm.PROTECT_SUPPORTED_PACKAGE_MANAGERS
      .includes(packageManager);
    if (!supportsProtect) {
      throw new Error(
        'Snyk protect for ' + pm.SUPPORTED_PACKAGE_MANAGER_NAME[packageManager] +
        ' projects is not currently supported');
    }
  } catch (error) {
    return Promise.reject(error);
  }

  if (options.interactive) {
    // silently fail
    return Promise.reject(new Error('Snyk protect interactive mode ' +
      'has moved. Please run `snyk wizard`'));
  }

  if (options['dry-run']) {
    debug('*** dry run ****');
  } else {
    debug('~~~~ LIVE RUN ~~~~');
  }

  return snyk.policy.load(options['policy-path'])
    .catch((error) => {
      if (error.code === 'ENOENT') {
        error.code = 'MISSING_DOTFILE';
      }

      throw error;
    }).then((policy) => {
      if (policy.patch) {
        return patch(policy, options);
      }
      return 'Nothing to do';
    });
}

function patch(policy, options) {
  return snyk.test(process.cwd(), options).then((res) => {
    if (!res.vulnerabilities) {
      const e = new Error('Code is already patched');
      e.code = 'ALREADY_PATCHED';
      throw e;
    }
    return protect.patch(res.vulnerabilities, !options['dry-run']);
  }).then(() => {
    analytics.add('success', true);
    return 'Successfully applied Snyk patches';
  }).catch((e) => {
    if (e.code === 'ALREADY_PATCHED') {
      analytics.add('success', true);
      return e.message + ', nothing to do';
    }

    analytics.add('success', false);

    throw e;
  });
}

module.exports = protectFunc;

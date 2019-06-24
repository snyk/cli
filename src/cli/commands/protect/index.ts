import * as debugModule from 'debug';
import * as snyk from '../../../lib/';
import * as types from '../../../lib/types';
import * as protect from '../../../lib/protect';
import * as analytics from '../../../lib/analytics';
import * as detect from '../../../lib/detect';
import * as pm from '../../../lib/package-managers';
import { CustomError } from '../../../lib/errors';
import { Options } from '../../../lib/plugins/types';
import { LegacyVulnApiResult } from '../../../lib/snyk-test/legacy';

const debug = debugModule('snyk');

function protectFunc(options: types.ProtectOptions & types.Options & types.TestOptions) {
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
    const packageManager: pm.SupportedPackageManagers = detect.detectPackageManager(process.cwd(), options);
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

async function patch(policy, options: Options) {
  try {
    const response = await snyk.test(process.cwd(), options) as LegacyVulnApiResult;
    // TODO: need to add support for multiple test results being returned
    // from test (for example gradle modules)

    if (!response.vulnerabilities) {
      const e = new CustomError('Code is already patched');
      e.strCode = 'ALREADY_PATCHED';
      e.code = 204;
      throw e;
    }
    await protect.patch(response.vulnerabilities, !options['dry-run']);
    analytics.add('success', true);
    return 'Successfully applied Snyk patches';
  } catch (e) {
    if (e.code === 'ALREADY_PATCHED') {
      analytics.add('success', true);
      return e.message + ', nothing to do';
    }

    analytics.add('success', false);

    throw e;
  }
}

module.exports = protectFunc;

export = ignore;

import * as policy from 'snyk-policy';
import chalk from 'chalk';
import * as authorization from '../../lib/authorization';
import * as auth from './auth/is-authed';
import { apiTokenExists } from '../../lib/api-token';
import { isCI } from '../../lib/is-ci';
import { MethodResult } from './types';

const util = require('util');
const debug = util.debuglog('snyk');

import { MisconfiguredAuthInCI } from '../../lib/errors/misconfigured-auth-in-ci-error';

function ignore(options): Promise<MethodResult> {
  debug('snyk ignore called with options: %O', options);

  return auth
    .isAuthed()
    .then((authed) => {
      if (!authed) {
        if (isCI()) {
          throw MisconfiguredAuthInCI();
        }
      }
      apiTokenExists();
    })
    .then(() => {
      return authorization.actionAllowed('cliIgnore', options);
    })
    .then((cliIgnoreAuthorization) => {
      if (!cliIgnoreAuthorization.allowed) {
        debug('snyk ignore called when disallowed');
        console.log(chalk.bold.red(cliIgnoreAuthorization.reason));
        return;
      }

      if (!options.id) {
        throw Error('idRequired');
      }
      options.expiry = new Date(options.expiry);
      if (options.expiry.getTime() !== options.expiry.getTime()) {
        debug('No/invalid expiry given, using the default 30 days');
        options.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      if (!options.reason) {
        options.reason = 'None Given';
      }

      debug(
        'changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
        options.id,
        options.reason,
        options.expiry,
      );
      return policy
        .load(options['policy-path'])
        .catch((error) => {
          if (error.code === 'ENOENT') {
            // file does not exist - create it
            return policy.create();
          }
          throw Error('policyFile');
        })
        .then(async function ignoreIssue(pol) {
          pol.ignore[options.id] = [
            {
              '*': {
                reason: options.reason,
                expires: options.expiry,
                created: new Date(),
              },
            },
          ];
          return await policy.save(pol, options['policy-path']);
        });
    });
}

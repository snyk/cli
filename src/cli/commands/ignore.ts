import * as policy from 'snyk-policy';
import chalk from 'chalk';
import * as authorization from '../../lib/authorization';
import * as auth from './auth/is-authed';
import { apiTokenExists } from '../../lib/api-token';
import { isCI } from '../../lib/is-ci';
import { IgnoreRules, MethodResult } from './types';

import * as Debug from 'debug';
const debug = Debug('snyk');

import { MisconfiguredAuthInCI } from '../../lib/errors/misconfigured-auth-in-ci-error';

export default function ignore(options): Promise<MethodResult> {
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

      const isPathProvided = !!options.path;
      if (!isPathProvided) {
        options.path = '*';
      }

      debug(
        `changing policy: ignore "%s", for %s, reason: "%s", until: %o`,
        options.id,
        isPathProvided ? 'all paths' : `path: '${options.path}'`,
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
          let ignoreRulePathDataIdx = -1;
          const ignoreParams = {
            reason: options.reason,
            expires: options.expiry,
            created: new Date(),
          };

          const ignoreRules: IgnoreRules = pol.ignore;

          const issueIgnorePaths = ignoreRules[options.id] ?? [];

          // Checking if the an ignore rule for this issue exists for the provided path.
          ignoreRulePathDataIdx = issueIgnorePaths.findIndex(
            (ignoreMetadata) => !!ignoreMetadata[options.path],
          );

          // If an ignore rule for this path doesn't exist, create one.
          if (ignoreRulePathDataIdx === -1) {
            issueIgnorePaths.push({
              [options.path]: ignoreParams,
            });
          }
          // Otherwise, update the existing rule's metadata.
          else {
            issueIgnorePaths[ignoreRulePathDataIdx][
              options.path
            ] = ignoreParams;
          }

          ignoreRules[options.id] = issueIgnorePaths;

          pol.ignore = ignoreRules;

          return await policy.save(pol, options['policy-path']);
        });
    });
}

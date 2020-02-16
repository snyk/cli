export = ignore;

import * as policy from 'snyk-policy';
import chalk from 'chalk';
import * as authorization from '../../lib/authorization';
import * as auth from './auth/is-authed';
import { apiTokenExists } from '../../lib/api-token';
import { isCI } from '../../lib/is-ci';

import * as Debug from 'debug';
const debug = Debug('snyk');

import { MisconfiguredAuthInCI } from '../../lib/errors/misconfigured-auth-in-ci-error';
import { generateIgnoreRule } from '../../lib/generate-ignore-rule';
import { loadOrCreatePolicy } from './load-or-create-policy';

async function ignore(options) {
  debug('`snyk ignore` called with options: %O', options);

  const isAuthed = auth.isAuthed();

  if (!isAuthed && isCI()) {
    throw MisconfiguredAuthInCI();
  }
  apiTokenExists();

  const cliIgnorePermissions = await authorization.actionAllowed(
    'cliIgnore',
    options,
  );

  if (!cliIgnorePermissions.allowed) {
    debug('No permission to ignore issues');
    console.log(chalk.bold.red(cliIgnorePermissions.reason));
    return;
  }

  const { id, expiry, reason } = options;

  if (!id) {
    throw Error('idRequired');
  }
  const ignoreReason = reason || 'None Given';

  debug(
    'changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
    id,
    reason,
    expiry,
  );

  const policyFile = await loadOrCreatePolicy(options['policy-path']);

  const ignoreRule = generateIgnoreRule(id, ignoreReason, expiry);
  policyFile.ignore = {
    ...policyFile.ignore,
    ...ignoreRule,
  };
  policy.save(policyFile, options['policy-path']);
}

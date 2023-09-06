import * as debugLib from 'debug';
import chalk from 'chalk';

import { makeRequest } from '../../request';
import { Global } from '../../../cli/args';
import { SastSettings } from './types';

declare const global: Global;
const debug = debugLib('snyk-code');

export function isLocalCodeEngine(sastSettings: SastSettings): boolean {
  const { sastEnabled, localCodeEngine } = sastSettings;

  return sastEnabled && localCodeEngine.enabled;
}

export async function logLocalCodeEngineVersion(lceUrl = ''): Promise<void> {
  const lceBaseUrl = lceUrl.replace('/api', '');
  const isNonSecureHttp = lceBaseUrl.match(/^http:/);
  let ignoreUnknownCAoriginalValue;
  if (isNonSecureHttp) {
    ignoreUnknownCAoriginalValue = global.ignoreUnknownCA;
    // `makeRequest` function converts `http` calls to `https`. In some cases, SCLE might be running on http.
    // This problem is fixed by setting `options.rejectUnauthorized = true`.
    // Setting `global.ignoreUnknownCA` to true adds rejectUnauthorized=true as an option in `makeRequest`.
    global.ignoreUnknownCA = true;
  }

  try {
    const {
      res: { body, statusCode },
    } = await makeRequest({
      url: `${lceBaseUrl}/status`,
      method: 'get',
    });
    if (body?.ok && body?.version) {
      debug(chalk.green(`Snyk Code Local Engine version: ${body.version}`));
      return;
    }

    if (body?.ok === false) {
      debug(
        chalk.red(
          `Snyk Code Local Engine health is not ok. statusCode:${statusCode}, version: ${body?.version}`,
        ),
      );
      debug(chalk.red(`Message: ${JSON.stringify(body?.message)}`));
      return;
    }

    debug(
      chalk.red(
        `Snyk Code Local Engine health check failed. statusCode:${statusCode}, version: ${JSON.stringify(
          body,
        )}`,
      ),
    );
  } catch (err) {
    debug('Snyk Code Local Engine health check failed.', err);
  } finally {
    if (isNonSecureHttp) {
      // Resetting `global.ignoreUnknownCA` to whatever value it had before I changed it above.
      global.ignoreUnknownCA = ignoreUnknownCAoriginalValue;
    }
  }
}

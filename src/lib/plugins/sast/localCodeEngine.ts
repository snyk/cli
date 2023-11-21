import * as debugLib from 'debug';
import chalk from 'chalk';
import { makeRequest } from '../../request';
import { SastSettings } from './types';

const debug = debugLib('snyk-code');

export function isLocalCodeEngine(sastSettings: SastSettings): boolean {
  const { sastEnabled, localCodeEngine } = sastSettings;

  return sastEnabled && localCodeEngine.enabled;
}

export async function logLocalCodeEngineVersion(
  localEngineUrl = '',
): Promise<void> {
  const parsedUrl = new URL(localEngineUrl);
  const localEngineBaseUrl = parsedUrl.origin;
  const isHttp = parsedUrl.protocol.match('http:');
  const originalProtocolUpgrade = process.env['SNYK_HTTP_PROTOCOL_UPGRADE'];
  if (isHttp) {
    process.env.SNYK_HTTP_PROTOCOL_UPGRADE = '0';
  }
  try {
    const {
      res: { body, statusCode },
    } = await makeRequest({
      url: `${localEngineBaseUrl}/status`,
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
    process.env.SNYK_HTTP_PROTOCOL_UPGRADE = originalProtocolUpgrade;
  }
}

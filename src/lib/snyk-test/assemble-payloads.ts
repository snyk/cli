import * as path from 'path';
import * as config from '../config';
import { isCI } from '../is-ci';
import { getPlugin } from '../ecosystems';
import { Ecosystem } from '../ecosystems/types';
import { Options, PolicyOptions, TestOptions } from '../types';
import { Payload } from './types';
import { assembleQueryString } from './common';
import spinner = require('../spinner');
import { findAndLoadPolicyForScanResult } from '../ecosystems/policy';
import { authHeaderWithApiTokenOrDockerJWT } from '../../lib/api-token';

export async function assembleEcosystemPayloads(
  ecosystem: Ecosystem,
  options: Options & TestOptions & PolicyOptions,
): Promise<Payload[]> {
  // For --all-projects packageManager is yet undefined here. Use 'all'
  let analysisTypeText = 'all dependencies for ';
  if (options.docker) {
    analysisTypeText = 'container dependencies for ';
  } else if (options.iac) {
    analysisTypeText = 'Infrastructure as code configurations for ';
  } else if (options.packageManager) {
    analysisTypeText = options.packageManager + ' dependencies for ';
  }

  const spinnerLbl =
    'Analyzing ' +
    analysisTypeText +
    (path.relative('.', path.join(options.path, options.file || '')) ||
      path.relative('..', '.') + ' project dir');

  spinner.clear<void>(spinnerLbl)();
  if (!options.quiet) {
    await spinner(spinnerLbl);
  }

  try {
    const plugin = getPlugin(ecosystem);
    const pluginResponse = await plugin.scan(options);

    const payloads: Payload[] = [];

    // TODO: This is a temporary workaround until the plugins themselves can read policy files and set names!
    for (const scanResult of pluginResponse.scanResults) {
      // WARNING! This mutates the payload. Policy logic should be in the plugin.
      const policy = await findAndLoadPolicyForScanResult(scanResult, options);
      if (policy !== undefined) {
        scanResult.policy = policy.toString();
      }

      // WARNING! This mutates the payload. The project name logic should be handled in the plugin.
      scanResult.name =
        options['project-name'] || config.PROJECT_NAME || scanResult.name;

      payloads.push({
        method: 'POST',
        url: `${config.API}${options.testDepGraphDockerEndpoint ||
          '/test-dependencies'}`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: authHeaderWithApiTokenOrDockerJWT(),
        },
        body: {
          scanResult,
        },
        qs: assembleQueryString(options),
      });
    }

    return payloads;
  } finally {
    spinner.clear<void>(spinnerLbl)();
  }
}

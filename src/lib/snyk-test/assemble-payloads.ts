import * as path from 'path';
import { DepGraph } from '@snyk/dep-graph';

import config from '../config';
import { isCI } from '../is-ci';
import { getPlugin } from '../ecosystems';
import { Ecosystem, ContainerTarget, ScanResult } from '../ecosystems/types';
import { filterDockerFacts } from '../ecosystems/common';
import { Options, PolicyOptions, TestOptions } from '../types';
import { Payload } from './types';
import { assembleQueryString } from './common';
import { spinner } from '../spinner';
import { findAndLoadPolicyForScanResult } from '../ecosystems/policy';
import { getAuthHeader } from '../../lib/api-token';
import { DockerImageNotFoundError } from '../errors';

export async function assembleEcosystemPayloads(
  ecosystem: Ecosystem,
  options: Options & TestOptions & PolicyOptions,
): Promise<Payload[]> {
  // For --all-projects packageManager is yet undefined here. Use 'all'
  let analysisTypeText = 'all dependencies for ';
  if (options.docker) {
    analysisTypeText = 'container dependencies for ';
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
    let pluginResponse = await plugin.scan(options);
    pluginResponse = await filterDockerFacts(
      pluginResponse,
      ecosystem,
      options,
    );

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
        url: `${config.API}${
          options.testDepGraphDockerEndpoint || '/test-dependencies'
        }`,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: getAuthHeader(),
        },
        body: {
          scanResult,
        },
        qs: assembleQueryString(options),
      });
    }

    return payloads;
  } catch (error) {
    if (ecosystem === 'docker' && error.message === 'authentication required') {
      throw new DockerImageNotFoundError(options.path);
    }
    if (ecosystem === 'docker' && error.message === 'invalid image format') {
      throw new DockerImageNotFoundError(options.path);
    }

    throw error;
  } finally {
    spinner.clear<void>(spinnerLbl)();
  }
}

// constructProjectName attempts to construct the project name the same way that
// registry does. This is a bit difficult because in Registry, the code is
// distributed over multiple functions and files that need to be kept in sync...
export function constructProjectName(sr: ScanResult): string {
  let suffix = '';
  if (sr.identity.targetFile) {
    suffix = ':' + sr.identity.targetFile;
  }

  if (sr.name) {
    return sr.name + suffix;
  }

  const targetImage = (sr.target as ContainerTarget | undefined)?.image;
  if (targetImage) {
    return targetImage + suffix;
  }

  const dgFact = sr.facts.find((d) => d.type === 'depGraph');
  // not every scanResult has a depGraph, for example the JAR fingerprints.
  if (dgFact) {
    const name = (dgFact.data as DepGraph | undefined)?.rootPkg.name;
    if (name) {
      return name + suffix;
    }
  }

  return 'no-name' + suffix;
}

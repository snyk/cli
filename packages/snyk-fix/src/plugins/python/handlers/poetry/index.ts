import * as debugLib from 'debug';
import * as ora from 'ora';

import { EntityToFix, FixOptions } from '../../../../types';
import { checkPackageToolSupported } from '../../../package-tool-supported';
import { PluginFixResponse } from '../../../types';
import { updateDependencies } from './update-dependencies';

const debug = debugLib('snyk-fix:python:Poetry');

export async function poetry(
  fixable: EntityToFix[],
  options: FixOptions,
): Promise<PluginFixResponse> {
  debug(`Preparing to fix ${fixable.length} Python Poetry projects`);
  const handlerResult: PluginFixResponse = {
    succeeded: [],
    failed: [],
    skipped: [],
  };

  await checkPackageToolSupported('poetry', options);
  for (const [index, entity] of fixable.entries()) {
    const spinner = ora({ isSilent: options.quiet, stream: process.stdout });
    const spinnerMessage = `Fixing pyproject.toml ${index + 1}/${
      fixable.length
    }`;
    spinner.text = spinnerMessage;
    spinner.start();

    const { failed, succeeded, skipped } = await updateDependencies(
      entity,
      options,
    );
    handlerResult.succeeded.push(...succeeded);
    handlerResult.failed.push(...failed);
    handlerResult.skipped.push(...skipped);
    spinner.stop();
  }

  return handlerResult;
}

import * as Debug from 'debug';
import { MethodArgs } from '../../args';
import { processCommandArgs } from '../process-command-args';
import {
  EValidSubCommands,
  validAppsSubCommands,
  SNYK_APP_DEBUG,
  ICreateAppOptions,
  AppsErrorMessages,
} from '../../../lib/apps';

import { createApp } from './create-app';
// import * as path from 'path';
import {
  createAppDataInteractive,
  createAppDataScriptable,
} from '../../../lib/apps/create-app';
import help from '../help';

const debug = Debug(SNYK_APP_DEBUG);

export default async function apps(
  ...args0: MethodArgs
): Promise<string | undefined | any> {
  debug('Snyk apps CLI called');

  const { options, paths } = processCommandArgs<ICreateAppOptions>(...args0);
  debug(options, paths);

  const commandVerb1 = paths[0];
  const validCommandVerb =
    commandVerb1 && validAppsSubCommands.includes(commandVerb1);
  if (!validCommandVerb) {
    // Display help md for apps
    debug(`Unknown subcommand: ${commandVerb1}`);
    return help('apps');
  }
  // Check if experimental flag is being used
  if (!options.experimental) throw new Error(AppsErrorMessages.useExperimental);

  if (commandVerb1 === EValidSubCommands.CREATE) {
    const createAppData = options.interactive
      ? await createAppDataInteractive()
      : createAppDataScriptable(options);
    return await createApp(createAppData);
  }
}

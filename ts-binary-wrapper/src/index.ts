#!/usr/bin/env node

import { argv } from 'process';
import * as common from './common';
import * as fs from 'fs';
import * as path from 'path';

const errorContextMessage = 'Runtime';
const fallbackScript = path.join(__dirname, '..', 'dist', 'cli', 'index.js');
const typescriptCliFlag = '--legacy-cli';

function run(executable: string): number {
  let cliArguments = common.getCliArguments(argv);

  if (executable.endsWith('.js')) {
    cliArguments = [executable].concat(cliArguments);
    executable = argv[0]; // node runtime
  }

  const exitCode = common.runWrapper(executable, cliArguments);
  return exitCode;
}

(async () => {
  let fallbackToTypescriptCli = argv.includes(typescriptCliFlag);

  if (fallbackToTypescriptCli === false) {
    try {
      const config = common.getCurrentConfiguration();
      const executable = config.getLocalLocation();

      if (!fs.existsSync(executable)) {
        console.error("Executable doesn't exist, trying to download.");

        const downloadError = await common.downloadExecutable(
          config.getDownloadLocation(),
          executable,
          config.getShasumFile(),
        );
        if (downloadError !== undefined) {
          throw downloadError;
        }
      }

      // run the executable
      process.exit(run(executable));
    } catch (error) {
      fallbackToTypescriptCli = true;
      await common.logError(errorContextMessage, error);
    }
  } else {
    // if --legacy-clli is enabled create a log messaeg
    await common.logError(
      errorContextMessage,
      Error(typescriptCliFlag + ' is set'),
      false,
    );
  }

  if (fallbackToTypescriptCli) {
    common.formatErrorMessage('legacy-cli');
    const exitCode = run(fallbackScript);
    common.formatErrorMessage('legacy-cli');

    process.exit(exitCode);
  }
})();

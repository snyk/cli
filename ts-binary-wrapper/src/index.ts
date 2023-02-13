#!/usr/bin/env node

import { argv } from 'process';
import * as common from './common';
import * as fs from 'fs';

const errorContextMessage = 'Download Error (Runtime)';

function run(executable: string) {
  const cliArguments = common.getCliArguments(argv);
  const exitCode = common.runWrapper(executable, cliArguments);
  process.exit(exitCode);
}

try {
  const config = common.getCurrentConfiguration();
  const executable = config.getLocalLocation();

  if (!fs.existsSync(executable)) {
    console.warn("Executable doesn't exist, trying to download.");
    common
      .downloadExecutable(
        config.getDownloadLocation(),
        executable,
        config.getShasumFile(),
      )
      .then((error) => {
        if (error !== undefined) {
          common
            .logError(errorContextMessage, error)
            .then(() => process.exit(2));
        } else {
          run(executable);
        }
      })
      .catch((error) => {
        common.logError(errorContextMessage, error).then(() => process.exit(2));
      });
  } else {
    run(executable);
  }
} catch (error) {
  common.logError(errorContextMessage, error).then(() => process.exit(2));
}

#!/usr/bin/env node

import { argv } from 'process';
import * as common from './common';
import * as fs from 'fs';
import * as path from 'path';

const errorContextMessage = 'Download Error (Runtime)';
const fallbackScript = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

function run(executable: string) {
  let cliArguments = common.getCliArguments(argv);

  if (executable.endsWith('.js')) {
    cliArguments = [executable].concat(cliArguments);
    executable = argv[0]; // node runtime
  }

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
  run(fallbackScript);
  common.logError(errorContextMessage, error).then(() => {});
}

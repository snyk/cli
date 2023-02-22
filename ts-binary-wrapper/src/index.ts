#!/usr/bin/env node

import { argv } from 'process';
import * as common from './common';
import * as fs from 'fs';
import * as path from 'path';

const errorContextMessage = 'Runtime Error';
const fallbackScript = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

function run(executable: string) : number {
  let cliArguments = common.getCliArguments(argv);

  if (executable.endsWith('.js')) {
    cliArguments = [executable].concat(cliArguments);
    executable = argv[0]; // node runtime
  }

  const exitCode = common.runWrapper(executable, cliArguments);
  return exitCode;
}

(async() => {
  let fallbackToLegacyCLI = argv.includes("--legacy-cli")

  if (fallbackToLegacyCLI == false) {
    try {
      const config = common.getCurrentConfiguration();
      const executable = config.getLocalLocation();
      
      if (!fs.existsSync(executable)) {
        console.error("Executable doesn't exist, trying to download.");
        
        const  downloadError = await common.downloadExecutable(config.getDownloadLocation(), executable, config.getShasumFile());
        if (downloadError !== undefined) {  
            throw downloadError;
        }
      } else {
        process.exit(run(executable));
      }
    } catch (error) {
      fallbackToLegacyCLI = true
      await common.logError(errorContextMessage, error);
    }
  }

  if (fallbackToLegacyCLI) {
    // TODO nice message
    const messsage = common.getWarningMessage("You are running a fallback version of the Snyk CLI!\n" + 
    "This is either due to an error using the standard CLI or due to the usage of --legacy-cli,\n" +
    "either way this fallback is only temporary. \n" +
    "If you don't know how to resolve the issue, please contact support@snyk.io.");
    
    console.error(messsage);
    const exitCode = run(fallbackScript);
    console.error(messsage);

    process.exit(exitCode);
  }
})();

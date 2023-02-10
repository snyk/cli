#!/usr/bin/env node

import { argv } from 'process';
import * as common from './common';

const config = common.getCurrentConfiguration();
const executable = config.getLocalLocation();
const cliArguments = common.getCliArguments(argv);
const exitCode = common.runWrapper(executable, cliArguments);
process.exit(exitCode);


import * as cluster from 'cluster';
import * as snykConfig from './config';
import * as modules from './modules';

import * as bus from './bus';
import * as policy from 'snyk-policy';
import * as config from './user-config';
import * as apiToken from './api-token';
import { SingleDepRootResult } from './types';

// This module exports a function-with-attributes object.
// Sometimes it is used for dependency injection (by patching the .test property).
// It's pretty hard to understand, and should be refactored.

// TODO(kyegupov): document, clean up, convert to named exports
// This might be delayed until all the users of this library are converted to Typescript.

// Pattern adapted from https://stackoverflow.com/a/41853194
const snyk = Object.assign(
  (options) => {
    if (!options) {
      options = {};
    }

    if (options.api) {
      snykConfig.api = options.api;
    }

    if (options.id) {
      snyk.id = options.id;
    }

    // FIXME add in pid + whether master + hostname + all these fields

    snyk.config.isMaster = cluster.isMaster;

    if (options.monitor && snyk.config.isMaster) {
      if (!snyk.api) {
        throw new Error('Snyk monitors require an authenticated account ' +
          'and API token');
      }
      // hook();
      require('./capture')();
    }

    return snyk;
  },
  {
    id: snykConfig.id,
    isRequired: true, // changed to false when loaded via cli
    isolate: {
      okay: () => true,
    },
    modules,
    // Dummy implementations of test and monitor, the actual ones are loaded later
    // to resolve a require cycle (index -> test -> run-test -> index)
    // TODO(kyegupov): avoid the require cycle
    test: (root, options, callback?) => new Promise((resolve, reject) => null),
    monitor: (root, meta, info: SingleDepRootResult) => new Promise<any>((resolve, reject) => null),
    bus,
    policy,
    config,
    api: 'dummy for Typescript, see defineProperty below',
  },
);

delete snyk.api;

// make snyk.api *always* get the latest api token from the config store
Object.defineProperty(snyk, 'api', {
  enumerable: true,
  configurable: true,
  get: () => apiToken(),
  set: (value) => {
    snykConfig.api = value;
  },
});

// tslint:disable-next-line:no-var-requires
snyk.test = require('./snyk-test');
import monitor = require('./monitor');
snyk.monitor = monitor;

export = snyk;

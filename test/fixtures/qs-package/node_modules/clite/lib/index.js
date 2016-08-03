'use strict';
const parseArgs = require('./args');
const debug = require('debug')('clite');
const getSettings = require('./settings');
const path = require('path');
const findRoot = require('./find-root');
const read = require('./read-stdin');

module.exports = (config, root) => {
  const paths = (root ?
      [path.join(root, 'node_modules')] :
      module.parent.parent.paths).slice(0); // copy
  let settings = getSettings(config);
  let help = '';

  return Promise.all([
    parseArgs(process.argv, config),
    read(),
    findRoot(paths).then(res => root = res),
  ]).then(res => {
    let args = res[0].args;
    help = res[0].help;
    let body = res[1];
    if (!args.$_ && !settings.commands._ && !body) {
      var e = new Error('BAD_ARGS');
      e.code = 'BAD_ARGS';
      return Promise.reject(e);
    }

    return loadCommand(root, args, body, settings);
  }).then(res => {
    require('./update')({ root: root });
    /* istanbul ignore if */
    if (!settings.return && res != undefined) { // jshint ignore:line
      return console.log(res);
    }

    return res;
  }).catch(e => {
    var promise = Promise.reject(e);

    if (e.code === 'BAD_ARGS') {
      // show either the configured help or the automatically generated help
      promise = loadCommand(root, {
        $_: ':::./help', help: true,
      }, null, settings).then(res => {
        var error = new Error(res); // based on loaded help
        error.code = 'BAD_ARGS';
        return Promise.reject(error);
      }).catch(error => {
        if (error.code === 'NO_HELP_CONFIGURED') {
          error.code = 'BAD_ARGS';
          error.message = help.trim();
        }

        if (error.code === 'BAD_ARGS' && e.message !== 'BAD_ARGS') {
          error.message = `${e.message}\n\n${error.message}`;
        }

        return Promise.reject(error);
      });
    }

    return promise.catch(e => {
      /* istanbul ignore if */
      if (!settings.return) {
        debug(e.stack);
        console.error(e.message);
        return process.exit(1);
      }
      return Promise.reject(e);
    });
  });
};

function loadCommand(root, args, body, settings) {
  var filename = args.$_;

  if (!filename) {
    var error = new Error('No command given');
    error.code = 'NO_COMMAND';
    return Promise.reject(error);
  }

  var internal = filename.indexOf(':::') === 0;
  if (internal) {
    filename = filename.slice(3);
    args.root = root;
    debug('loading internal module: %s', filename);
  } else {
    filename = path.resolve(root, filename);
    debug('loading %s', filename);
  }

  return new Promise(resolve => {
    resolve(require(filename));
  }).catch(e => {
    e.message = `Fatal: command failed to load "${filename}"`;
    return Promise.reject(e);
  }).then(res => res(args, settings, body)).then(res => {
    /* istanbul ignore if */
    if (!settings.return && internal) {
      console.log(res);
      // internal commands always immediately exit
      return process.exit(0);
    }
    return res;
  });
}
module.exports = auth;

/**
 * Credit, nearly entirely taken from
 * https://github.com/semantic-release/cli/blob/master/src/lib/github.js
 * MIT https://github.com/semantic-release/cli/blob/acb47922/README.md#license
 */

var debug = require('debug')('snyk');
var pkg = require('../../package.json');
var keytar = require('keytar');
var inquirer = require('inquirer');
var validator = require('validator');
var crypto = require('crypto');
var base32 = require('base32');
var request = require('request');
var _ = require('lodash');

var passwordStorage = passwordStorageService('github');

function passwordStorageService(service) {
  var key = pkg.name + ':' + service;

  return {
    get: function (username) {
      debug('getting from keytar');
      return keytar.getPassword(key, username);
    },
    set: function (username, password) {
      debug('setting keytar');
      keytar.replacePassword(key, username, password);
    },
  };
}

function ask2FA(cb) {
  debug('require 2FA');
  inquirer.prompt([{
    type: 'input',
    name: 'code',
    message: 'What is your GitHub two-factor authentication code?',
    validate: validator.isNumeric,
  }, ], function (answers) {
    cb(answers.code);
  });
}

function randomId() {
  return base32.encode(crypto.randomBytes(4));
}

function createAuthorization(info, cb) {
  var log = info.log;
  // var reponame = info.ghrepo && info.ghrepo.slug[1];
  // var node = (reponame ? '-' + reponame + '-' : '-') + randomId();

  var payload = {
    method: 'POST',
    url: info.github.endpoint + '/authorizations',
    json: true,
    auth: info.github,
    headers: {
      'User-Agent': 'snyk',
      'X-GitHub-OTP': info.github.code,
    },
    body: {
      scopes: [
        'user:email',
      ],
      fingerprint: 'snyk',
      note: 'snyk', // + node,
    },
  };

  debug('request', payload);

  request(payload, function (err, response, body) {
    debug('response: %s', response.statusCode, body);
    if (err) {
      return cb(err);
    }

    var status = response.statusCode;

    if (status === 201) {
      return cb(null, body);
    }

    if (status === 401 && response.headers['x-github-otp']) {
      var type = response.headers['x-github-otp'].split('; ')[1];

      if (info.github.retry) {
        log.warn('Invalid two-factor authentication code.');
      } else {
        log.info('Two-factor authentication code needed via %s.', type);
      }

      ask2FA(function (code) {
        info.github.code = code;
        info.github.retry = true;
        createAuthorization(info, cb);
      });

      return;
    }

    cb(new Error('Could not login to GitHub.'));
  });
}

function github() {
  return new Promise(function (resolve, reject) {
    var info = {
      options: { keychain: true, 'ask-for-passwords': false, },
    };

    info.log = require('../log')('warn');

    inquirer.prompt([{
      type: 'input',
      name: 'username',
      message: 'What is your GitHub username?',
      default: process.env.USER,
      validate: _.ary(_.bind(validator.isLength, validator, _, 1), 1),
    }, {
      type: 'password',
      name: 'password',
      message: 'What is your GitHub password?',
      validate: _.ary(_.bind(validator.isLength, validator, _, 1), 1),
      when: function (answers) {
        if (!info.options.keychain) {
          return true;
        }
        if (info.options['ask-for-passwords']) {
          return true;
        }
        return !passwordStorage.get(answers.username);
      },
    }, ], function (answers) {
      answers.password = answers.password ||
                         passwordStorage.get(answers.username);

      info.github = answers;
      info.github.endpoint = info.ghepurl || 'https://api.github.com';

      createAuthorization(info, function (err, data) {
        if (err) {
          info.log.error('Could not login to GitHub. Check your credentials.');
          return reject(err);
        }

        if (info.options.keychain) {
          passwordStorage.set(info.github.username, info.github.password);
        }

        info.github.token = data.token;
        info.log.info('Successfully created GitHub token.');
        resolve(info);
      });
    });
  });
}

function auth() {
  return github();

  // return github().then(function (info) {
  //   return new Promise(function (resolve, reject) {

  //   });
  // });
}
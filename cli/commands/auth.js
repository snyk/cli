module.exports = auth;
module.exports.isAuthed = isAuthed;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var debug = require('debug')('snyk');
var open = require('open');
var snyk = require('../../lib/');
var config = require('../../lib/config');
var isCI = require('../../lib/is-ci');
var request = require('../../lib/request');
var url = require('url');
var uuid = require('node-uuid');
var spinner = require('../../lib/spinner');
var apiUrl = url.parse(config.API);
var authUrl = apiUrl.protocol + '//' + apiUrl.host;
var attemptsLeft = 0;

function resetAttempts() {
  attemptsLeft = 30;
}

function githubAuth(via) {
  var token = uuid.v4(); // generate a random key
  var redirects = {
    wizard: '/authenticated',
  };

  var url = authUrl + '/login?token=' + token;

  // validate that via comes from our code, and not from user & CLI
  // currently only support `wizard` but we'll add more over time.
  if (redirects[via]) {
    url += '&redirectUri=' + new Buffer(redirects[via]).toString('base64');
  }

  var msg =
    '\nNow redirecting you to our github auth page, go ahead and log in,\n' +
    'and once the auth is complete, return to this prompt and you\'ll\n' +
    'be ready to start using snyk.\n\nIf you can\'t wait use this url:\n' +
    url + '\n';

  // suppress this message in CI
  if (!isCI) {
    console.log(msg);
  } else {
    var error = new Error('noAuthInCI');
    error.code = 'AUTH_IN_CI';
    return Promise.reject(error);
  }

  var lbl = 'Waiting...';

  return spinner(lbl).then(function () {
    setTimeout(function () {
      open(url);
    }, 2000);
    // start checking the token immediately in case they've already
    // opened the url manually
    return testAuthComplete(token).then(spinner.clear(lbl));
  });
}

function testAuthComplete(token) {
  var payload = {
    body: {
      token: token,
    },
    url: config.API + '/verify/callback',
    json: true,
    method: 'post',
  };

  return new Promise(function (resolve, reject) {
    debug(payload);
    request(payload, function (error, res, body) {
      debug(error, (res || {}).statusCode, body);
      if (error) {
        return reject(error);
      }


      if (res.statusCode !== 200) {
        var e = new Error(body.message);
        e.code = res.statusCode;
        return reject(e);
      }

      // we have success
      if (body.api) {
        return resolve({
          res: res,
          body: body,
        });
      }

      // we need to wait and poll again in a moment
      setTimeout(function () {
        attemptsLeft--;
        if (attemptsLeft > 0) {
          return resolve(testAuthComplete(token));
        }

        var error = new Error('Sorry, but your authentication token has now' +
          ' expired.\nPlease try to authenticate again.');
        error.code = 'AUTH_TIMEOUT';
        reject(error);
      }, 1000);
    });
  });
}

function isAuthed() {
  var token = snyk.config.get('api');
  return verifyAPI(token).then(function (res) {
    return res.body.ok;
  });
}

function verifyAPI(api) {
  var payload = {
    body: {
      api: api,
    },
    method: 'POST',
    url: config.API + '/verify/token',
    json: true,
  };

  return new Promise(function (resolve, reject) {
    request(payload, function (error, res, body) {
      if (error) {
        return reject(error);
      }

      resolve({
        res: res,
        body: body,
      });
    });
  });
}

function auth(api, via) {
  var promise;
  resetAttempts();
  if (api) {
    // user is manually setting the API token on the CLI - let's trust them
    promise = verifyAPI(api);
  } else {
    promise = githubAuth(via);
  }

  return promise.then(function (data) {
    var res = data.res;
    var body = res.body;
    debug(body);

    if (res.statusCode === 200 || res.statusCode === 201) {
      snyk.config.set('api', body.api);
      return '\nYour account has been authenticated. Snyk is now ready to ' +
        'be used.\n';
    }

    if (body.message) {
      var error = new Error(body.message);
      error.code = res.statusCode;
      throw error;
    }

    throw new Error('authfail');
  });
}

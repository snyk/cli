import * as Debug from 'debug';
import * as open from 'opn';
import * as snyk from '../../lib/';
import * as config from '../../lib/config';
import * as isCI from '../../lib/is-ci';
import * as request from '../../lib/request';
import * as url from 'url';
import * as uuid from 'uuid';
import * as spinner from '../../lib/spinner';
import { CustomError } from '@snyk/dep-graph/dist/core/errors/custom-error';

const apiUrl = url.parse(config.API);
const authUrl = apiUrl.protocol + '//' + apiUrl.host;
const debug = Debug('snyk-auth');
let attemptsLeft = 0;

function resetAttempts() {
  attemptsLeft = 30;
}

function githubAuth(via) {
  const token = uuid.v4(); // generate a random key
  const redirects = {
    wizard: '/authenticated',
  };

  let urlStr = authUrl + '/login?token=' + token;

  // validate that via comes from our code, and not from user & CLI
  // currently only support `wizard` but we'll add more over time.
  if (redirects[via]) {
    urlStr += '&redirectUri=' + new Buffer(redirects[via]).toString('base64');
  }

  const msg =
    '\nNow redirecting you to our auth page, go ahead and log in,\n' +
    'and once the auth is complete, return to this prompt and you\'ll\n' +
    'be ready to start using snyk.\n\nIf you can\'t wait use this url:\n' +
    urlStr + '\n';

  // suppress this message in CI
  if (!isCI) {
    console.log(msg);
  } else {
    const error = new CustomError('noAuthInCI');
    error.code = 'AUTH_IN_CI';
    return Promise.reject(error);
  }

  const lbl = 'Waiting...';

  return spinner(lbl).then(() => {
    setTimeout(() => {
      open(urlStr, {wait: false});
    }, 2000);
    // start checking the token immediately in case they've already
    // opened the url manually
    return testAuthComplete(token);
  })
    // clear spinnger in case of success or failure
    .then(spinner.clear(lbl))
    .catch((error) => {
      spinner.clear(lbl)();
      throw error;
    });
}

function testAuthComplete(token) {
  const payload = {
    body: {
      token,
    },
    url: config.API + '/verify/callback',
    json: true,
    method: 'post',
  };

  return new Promise((resolve, reject) => {
    debug(payload);
    request(payload, (error, res, body) => {
      debug(error, (res || {}).statusCode, body);
      if (error) {
        return reject(error);
      }

      if (res.statusCode !== 200) {
        const e = new Error(body.message);
        e.code = res.statusCode;
        return reject(e);
      }

      // we have success
      if (body.api) {
        return resolve({
          res,
          body,
        });
      }

      // we need to wait and poll again in a moment
      setTimeout(() => {
        attemptsLeft--;
        if (attemptsLeft > 0) {
          return resolve(testAuthComplete(token));
        }

        const error = new CustomError('Sorry, but your authentication token has now' +
          ' expired.\nPlease try to authenticate again.');
        error.code = 'AUTH_TIMEOUT';
        reject(error);
      }, 1000);
    });
  });
}

export function isAuthed() {
  const token = snyk.config.get('api');
  return verifyAPI(token).then((res) => {
    return res.body.ok;
  });
}

function verifyAPI(api) {
  const payload = {
    body: {
      api,
    },
    method: 'POST',
    url: config.API + '/verify/token',
    json: true,
  };

  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      resolve({
        res,
        body,
      });
    });
  });
}

export function auth(api, via) {
  let promise;
  resetAttempts();
  if (api) {
    // user is manually setting the API token on the CLI - let's trust them
    promise = verifyAPI(api);
  } else {
    promise = githubAuth(via);
  }

  return promise.then((data) => {
    const res = data.res;
    const body = res.body;
    debug(body);

    if (res.statusCode === 200 || res.statusCode === 201) {
      snyk.config.set('api', body.api);
      return '\nYour account has been authenticated. Snyk is now ready to ' +
        'be used.\n';
    }

    if (body.message) {
      const error = new CustomError(body.message);
      error.code = res.statusCode;
      throw error;
    }

    throw new CustomError('authfail');
  });
}

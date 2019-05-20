import * as Debug from 'debug';
import * as open from 'opn';
import * as snyk from '../../../lib';
import * as config from '../../../lib/config';
import {isCI} from '../../../lib/is-ci';
import * as request from '../../../lib/request';
import * as url from 'url';
import * as uuid from 'uuid';
import * as spinner from '../../../lib/spinner';
import { TokenExpiredError } from '../../../lib/errors/token-expired-error';
import { MisconfiguredAuthInCI } from '../../../lib/errors/misconfigured-auth-in-ci-error';
import { AuthFailedError } from '../../../lib/errors/authentication-failed-error';
import {verifyAPI} from './is-authed';

module.exports = auth;

const apiUrl = url.parse(config.API);
const authUrl = apiUrl.protocol + '//' + apiUrl.host;
const debug = Debug('snyk-auth');
let attemptsLeft = 0;

function resetAttempts() {
  attemptsLeft = 30;
}

type AuthCliCommands = 'wizard' | 'ignore';

async function webAuth(via: AuthCliCommands) {
  const token = uuid.v4(); // generate a random key
  const redirects = {
    wizard: '/authenticated',
  };

  let urlStr = authUrl + '/login?token=' + token;

  // validate that via comes from our code, and not from user & CLI
  if (redirects[via]) {
    urlStr += '&redirectUri=' + new Buffer(redirects[via]).toString('base64');
  }

  const msg =
    '\nNow redirecting you to our auth page, go ahead and log in,\n' +
    'and once the auth is complete, return to this prompt and you\'ll\n' +
    'be ready to start using snyk.\n\nIf you can\'t wait use this url:\n' +
    urlStr + '\n';

  // suppress this message in CI
  if (!isCI()) {
    console.log(msg);
  } else {
    return Promise.reject(MisconfiguredAuthInCI());
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

async function testAuthComplete(token: string) {
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
        return reject(AuthFailedError(body.message, res.statusCode));
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

        reject(TokenExpiredError());
      }, 1000);
    });
  });
}

async function auth(apiToken: string, via: AuthCliCommands) {
  let promise;
  resetAttempts();
  if (apiToken) {
    // user is manually setting the API token on the CLI - let's trust them
    promise = verifyAPI(apiToken);
  } else {
    promise = webAuth(via);
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
    throw AuthFailedError(body.message, res.statusCode);
  });
}

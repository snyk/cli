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

const apiUrl = url.parse(config.API);
const authUrl = apiUrl.protocol + '//' + apiUrl.host;
const debug = Debug('snyk-auth');
let attemptsLeft = 0;

module.exports = auth;

function resetAttempts() {
  attemptsLeft = 30;
}

type AuthCliCommands = 'wizard' | 'ignore';
interface WebAuthResponse {
  res: object;
  body: object;
}

async function webAuth(via: AuthCliCommands): Promise<WebAuthResponse> {
  const token = uuid.v4(); // generate a random key
  const redirects = {
    wizard: '/authenticated',
  };

  if (isCI()) {
    throw MisconfiguredAuthInCI();
  }

  let urlStr = authUrl + '/login?token=' + token;

  // validate that via comes from our code, and not from user & CLI
  if (redirects[via]) {
    urlStr += '&redirectUri=' + new Buffer(redirects[via]).toString('base64');
  }

  console.log(
    '\nNow redirecting you to our auth page, go ahead and log in,\n' +
    'and once the auth is complete, return to this prompt and you\'ll\n' +
    'be ready to start using snyk.\n\nIf you can\'t wait use this url:\n' +
    urlStr + '\n');

  try {
    setTimeout(() => {
      open(urlStr, {wait: false});
    }, 2000);
    // start checking the token immediately in case they've already
    // opened the url manually
    return testAuthComplete(token);
  } catch (error) {
    throw error;
  }
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

  debug(payload);
  const callBackRes = await request(payload);
  const {error, res, body} = callBackRes;
  debug(error, (res || {}).statusCode, body);

  if (error) {
    throw error;
  }

  if (res.statusCode !== 200) {
    throw AuthFailedError(body.message, res.statusCode);
  }

  if (!body.api) {
    // retry request
    setTimeout(() => {
      attemptsLeft--;
      if (attemptsLeft > 0) {
        return testAuthComplete(token);
      }

      throw TokenExpiredError();
    }, 1000);
  }

  return {
    res,
    body,
  };
}

async function auth(apiToken: string, via: AuthCliCommands) {
  let authPromise;
  resetAttempts();
  if (apiToken) {
    // user is manually setting the API token on the CLI - let's trust them
    authPromise = verifyAPI(apiToken);
  } else {
    authPromise = webAuth(via);
  }

  const authResponse = await authPromise;
  const res = authResponse.res;
  const body = res.body;
  debug(body);

  if (!(res.statusCode === 200 || res.statusCode === 201)) {
    throw AuthFailedError(body.message, res.statusCode);
  }

  snyk.config.set('api', body.api);
  return '\nYour account has been authenticated. Snyk is now ready to ' +
    'be used.\n';
}

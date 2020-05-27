import * as dns from 'dns';
import * as url from 'url';
import * as util from 'util';
import * as open from 'open';
import * as uuid from 'uuid';
import * as Debug from 'debug';
import { Spinner } from 'cli-spinner';
import { IPv6, parse } from 'ipaddr.js';

import * as snyk from '../../../lib';
import { verifyAPI } from './is-authed';
import { isCI } from '../../../lib/is-ci';
import * as config from '../../../lib/config';
import request = require('../../../lib/request');
import { CustomError } from '../../../lib/errors';
import { getUtmsAsString } from '../../../lib/utm';
import { AuthFailedError } from '../../../lib/errors';
import { TokenExpiredError } from '../../../lib/errors/token-expired-error';
import { MisconfiguredAuthInCI } from '../../../lib/errors/misconfigured-auth-in-ci-error';
import { Payload } from '../../../lib/request/types';

export = auth;

const dnsLookupPromise = util.promisify(dns.lookup);

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

  const utmParams = getUtmsAsString();
  if (utmParams) {
    urlStr += '&' + utmParams;
  }

  // validate that via comes from our code, and not from user & CLI
  if (redirects[via]) {
    urlStr += '&redirectUri=' + Buffer.from(redirects[via]).toString('base64');
  }

  const msg =
    '\nNow redirecting you to our auth page, go ahead and log in,\n' +
    "and once the auth is complete, return to this prompt and you'll\n" +
    "be ready to start using snyk.\n\nIf you can't wait use this url:\n" +
    urlStr +
    '\n';

  // suppress this message in CI
  if (!isCI()) {
    console.log(msg);
  } else {
    return Promise.reject(MisconfiguredAuthInCI());
  }
  const spinner = new Spinner('Waiting...');
  spinner.setSpinnerString('|/-\\');

  const ipFamily = await getIpFamily();

  try {
    spinner.start();
    await setTimeout(() => {
      open(urlStr);
    }, 0);

    return await testAuthComplete(token, ipFamily);
  } finally {
    spinner.stop(true);
  }
}

async function testAuthComplete(
  token: string,
  ipFamily?: number,
): Promise<{ res; body }> {
  const payload: Partial<Payload> = {
    body: {
      token,
    },
    url: config.API + '/verify/callback',
    json: true,
    method: 'post',
  };

  if (ipFamily) {
    payload.family = ipFamily;
  }

  return new Promise((resolve, reject) => {
    debug(payload);
    request(payload, (error, res, body) => {
      debug(error, (res || {}).statusCode, body);
      if (error) {
        return reject(error);
      }

      if (res.statusCode !== 200) {
        return reject(errorForFailedAuthAttempt(res, body));
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
          return resolve(testAuthComplete(token, ipFamily));
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
      return (
        '\nYour account has been authenticated. Snyk is now ready to ' +
        'be used.\n'
      );
    }
    throw errorForFailedAuthAttempt(res, body);
  });
}

/**
 * Resolve an appropriate error for a failed attempt to authenticate
 *
 * @param res The response from the API
 * @param body The body of the failed authentication request
 */
function errorForFailedAuthAttempt(res, body) {
  if (res.statusCode === 401 || res.statusCode === 403) {
    return AuthFailedError(body.userMessage, res.statusCode);
  } else {
    const userMessage = body && body.userMessage;
    const error = new CustomError(userMessage || 'Auth request failed');
    if (userMessage) {
      error.userMessage = userMessage;
    }
    error.code = res.statusCode;
    return error;
  }
}

async function getIpFamily(): Promise<6 | undefined> {
  const IPv6Family = 6;

  try {
    const { address } = await dnsLookupPromise(apiUrl.hostname!, {
      family: IPv6Family,
    });
    const res = parse(address) as IPv6;
    return !res.isIPv4MappedAddress() ? IPv6Family : undefined;
  } catch (e) {
    /* IPv6 is not enabled */
    return undefined;
  }
}

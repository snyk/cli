/*!
 * csurf
 * Copyright(c) 2011 Sencha Inc.
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var Cookie = require('cookie');
var createError = require('http-errors');
var sign = require('cookie-signature').sign;
var Tokens = require('csrf');

/**
 * CSRF protection middleware.
 *
 * This middleware adds a `req.csrfToken()` function to make a token
 * which should be added to requests which mutate
 * state, within a hidden form field, query-string etc. This
 * token is validated against the visitor's session.
 *
 * @param {Object} options
 * @return {Function} middleware
 * @api public
 */

module.exports = function csurf(options) {
  options = options || {};

  // get cookie options
  var cookie = getCookieOptions(options.cookie)

  // get session options
  var sessionKey = options.sessionKey || 'session'

  // get value getter
  var value = options.value || defaultValue

  // token repo
  var tokens = new Tokens(options);

  // ignored methods
  var ignoreMethods = options.ignoreMethods === undefined
    ? ['GET', 'HEAD', 'OPTIONS']
    : options.ignoreMethods

  if (!Array.isArray(ignoreMethods)) {
    throw new TypeError('option ignoreMethods must be an array')
  }

  // generate lookup
  var ignoreMethod = getIgnoredMethods(ignoreMethods)

  return function csrf(req, res, next) {
    var secret = getsecret(req, sessionKey, cookie)
    var token

    // lazy-load token getter
    req.csrfToken = function csrfToken() {
      var sec = !cookie
        ? getsecret(req, sessionKey, cookie)
        : secret

      // use cached token if secret has not changed
      if (token && sec === secret) {
        return token
      }

      // generate & set new secret
      if (sec === undefined) {
        sec = tokens.secretSync()
        setsecret(req, res, sessionKey, sec, cookie)
      }

      // update changed secret
      secret = sec

      // create new token
      token = tokens.create(secret)

      return token
    }

    // generate & set secret
    if (!secret) {
      secret = tokens.secretSync()
      setsecret(req, res, sessionKey, secret, cookie)
    }

    // verify the incoming token
    if (!ignoreMethod[req.method]) {
      verifytoken(req, tokens, secret, value(req))
    }

    next()
  }
};

/**
 * Default value function, checking the `req.body`
 * and `req.query` for the CSRF token.
 *
 * @param {IncomingMessage} req
 * @return {String}
 * @api private
 */

function defaultValue(req) {
  return (req.body && req.body._csrf)
    || (req.query && req.query._csrf)
    || (req.headers['csrf-token'])
    || (req.headers['xsrf-token'])
    || (req.headers['x-csrf-token'])
    || (req.headers['x-xsrf-token']);
}

/**
 * Get options for cookie.
 *
 * @param {boolean|object} [options]
 * @returns {object}
 * @api private
 */

function getCookieOptions(options) {
  if (options !== true && typeof options !== 'object') {
    return undefined
  }

  var opts = {
    key: '_csrf',
    path: '/'
  }

  if (options && typeof options === 'object') {
    for (var prop in options) {
      var val = options[prop]

      if (val !== undefined) {
        opts[prop] = val
      }
    }
  }

  return opts
}

/**
 * Get a lookup of ignored methods.
 *
 * @param {array} methods
 * @returns {object}
 * @api private
 */

function getIgnoredMethods(methods) {
  var obj = Object.create(null)

  for (var i = 0; i < methods.length; i++) {
    var method = methods[i].toUpperCase()
    obj[method] = true
  }

  return obj
}

/**
 * Get the token secret from the request.
 *
 * @param {IncomingMessage} req
 * @param {String} sessionKey
 * @param {Object} [cookie]
 * @api private
 */

function getsecret(req, sessionKey, cookie) {
  var secret

  if (cookie) {
    // get secret from cookie
    var bag = cookie.signed
      ? 'signedCookies'
      : 'cookies'

    secret = req[bag][cookie.key]
  } else if (req[sessionKey]) {
    // get secret from session
    secret = req[sessionKey].csrfSecret
  } else {
    throw new Error('misconfigured csrf')
  }

  return secret
}

/**
 * Set a cookie on the HTTP response.
 *
 * @param {OutgoingMessage} res
 * @param {string} name
 * @param {string} val
 * @param {Object} [options]
 * @api private
 */

function setcookie(res, name, val, options) {
  var data = Cookie.serialize(name, val, options);

  var prev = res.getHeader('set-cookie') || [];
  var header = Array.isArray(prev) ? prev.concat(data)
    : Array.isArray(data) ? [prev].concat(data)
    : [prev, data];

  res.setHeader('set-cookie', header);
}

/**
 * Set the token secret on the request.
 *
 * @param {IncomingMessage} req
 * @param {OutgoingMessage} res
 * @param {string} sessionKey
 * @param {string} val
 * @param {Object} [cookie]
 * @api private
 */

function setsecret(req, res, sessionKey, val, cookie) {
  if (cookie) {
    // set secret on cookie
    if (cookie.signed) {
      var secret = req.secret

      if (!secret) {
        throw new Error('cookieParser("secret") required for signed cookies')
      }

      val = 's:' + sign(val, secret)
    }

    setcookie(res, cookie.key, val, cookie);
  } else if (req[sessionKey]) {
    // set secret on session
    req[sessionKey].csrfSecret = val
  } else {
    /* istanbul ignore next: should never actually run */
    throw new Error('misconfigured csrf')
  }
}

/**
 * Verify the token.
 *
 * @param {IncomingMessage} req
 * @param {Object} tokens
 * @param {string} secret
 * @param {string} val
 * @api private
 */

function verifytoken(req, tokens, secret, val) {
  // valid token
  if (!tokens.verify(secret, val)) {
    throw createError(403, 'invalid csrf token', {
      code: 'EBADCSRFTOKEN'
    });
  }
}

/*!
 * uid-safe
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var crypto = require('crypto')
var escape = require('base64-url').escape

/**
 * Module exports.
 * @public
 */

module.exports = uid
module.exports.sync = uidSync

/**
 * Create a unique ID.
 *
 * @param {number} length
 * @param {function} [callback]
 * @return {Promise}
 * @public
 */

function uid(length, callback) {
  // validate callback is a function, if provided
  if (callback !== undefined && typeof callback !== 'function') {
    throw new TypeError('argument callback must be a function')
  }

  // require the callback without promises
  if (!callback && !global.Promise) {
    throw new TypeError('argument callback is required')
  }

  if (callback) {
    // classic callback style
    return generateUid(length, callback)
  }

  return new Promise(function executor(resolve, reject) {
    generateUid(length, function onUid(err, str) {
      if (err) return reject(err)
      resolve(str)
    })
  })
}

/**
 * Create a unique ID sync.
 *
 * @param {number} length
 * @return {string}
 * @public
 */

function uidSync(length) {
  try {
    return toString(crypto.randomBytes(length))
  } catch (e) {
    return toString(crypto.pseudoRandomBytes(length))
  }
}

/**
 * Generate a unique ID string.
 *
 * @param {number} length
 * @param {function} callback
 * @private
 */

function generateUid(length, callback) {
  randomBytes(length, function (err, buf) {
    if (err) return callback(err)
    callback(null, toString(buf))
  })
}

/**
 * Get some random bytes.
 *
 * @param {number} length
 * @param {function} callback
 * @return {Buffer}
 * @private
 */

function randomBytes(length, callback) {
  crypto.randomBytes(length, function (err, buf) {
    if (!err) return callback(null, buf)
    crypto.pseudoRandomBytes(length, function (err, buf) {
      if (err) return callback(err)
      callback(null, buf)
    })
  })
}

/**
 * Change a Buffer into a string.
 *
 * @param {Buffer} buf
 * @return {string}
 * @private
 */

function toString(buf) {
  return escape(buf.toString('base64'))
}

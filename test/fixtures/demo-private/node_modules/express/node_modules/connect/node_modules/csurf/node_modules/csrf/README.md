# CSRF

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-image]][node-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Logic behind CSRF token creation and verification.

Read [Understanding-CSRF](https://github.com/pillarjs/understanding-csrf)
for more information on CSRF. Use this module to create custom CSRF middleware.

Looking for a CSRF framework for your favorate framework that uses this
module?

  * Express/connect: [csurf](https://www.npmjs.com/package/csurf) or
    [alt-xsrf](https://www.npmjs.com/package/alt-xsrf)
  * Koa: [koa-csrf](https://www.npmjs.com/package/koa-csrf) or
    [koa-atomic-session](https://www.npmjs.com/package/koa-atomic-session)

### Install

```bash
$ npm install csrf
```

## API

```js
var Tokens = require('csrf')
```

### new Tokens([options])

Create a new token generation/verification instance. The `options` argument is
optional and will just use all defaults if missing.

#### Options

Morgan accepts these properties in the options object.

##### saltLength

The length of the internal salt to use, in characters. Internally, the salt
is a base 62 string. Defaults to `8` characters.

##### secretLength

The length of the secret to generate, in bytes. Note that the secret is
passed around base-64 encoded and that this length refers to the underlying
bytes, not the length of the base-64 string. Defaults to `18` bytes.

#### tokens.create(secret)

Create a new CSRF token attached to the given `secret`. The `secret` is a
string, typically generated from the `tokens.secret()` or `tokens.secretSync()`
methods. This token is what you should add into HTML `<form>` blocks and
expect the user's browser to provide back.

```js
var secret = tokens.secretSync()
var token = tokens.create(secret)
```

#### tokens.secret(callback)

Asynchronously create a new `secret`, which is a string. The secret is to
be kept on the server, typically stored in a server-side session for the
user. The secret should be at least per user.

```js
tokens.secret(function (err, secret) {
  if (err) throw err
  // do something with the secret
})
```

#### tokens.secret()

Asynchronously create a new `secret` and return a `Promise`. Please see
`tokens.secret(callback)` documentation for full details.

**Note**: To use promises in Node.js _prior to 0.12_, promises must be
"polyfilled" using `global.Promise = require('bluebird')`.

```js
tokens.secret().then(function (secret) {
  // do something with the secret
})
```

#### tokens.secretSync()

A synchronous version of `tokens.secret(callback)`. Please see
`tokens.secret(callback)` documentation for full details.

```js
var secret = tokens.secretSync()
```

#### tokens.verify(secret, token)

Check whether a CSRF token is valid for the given `secret`, returning
a Boolean.

```js
if (!tokens.verify(secret, token)) {
  throw new Error('invalid token!')
}
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/csrf.svg
[npm-url]: https://npmjs.org/package/csrf
[node-image]: https://img.shields.io/node/v/csrf.svg
[node-url]: http://nodejs.org/download/
[travis-image]: https://img.shields.io/travis/pillarjs/csrf/master.svg
[travis-url]: https://travis-ci.org/pillarjs/csrf
[coveralls-image]: https://img.shields.io/coveralls/pillarjs/csrf/master.svg
[coveralls-url]: https://coveralls.io/r/pillarjs/csrf?branch=master
[downloads-image]: https://img.shields.io/npm/dm/csrf.svg
[downloads-url]: https://npmjs.org/package/csrf

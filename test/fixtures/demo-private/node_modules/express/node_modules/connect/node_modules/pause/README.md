# pause

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-image]][node-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Pause a stream's data events

## Installation

```sh
$ npm install pause
```

## API

```js
var pause = require('pause')
```

### handle = pause(stream)

Pause the data events on a stream and return a handle to resume or end the
stream.

#### handle.end()

Dispose of the handle. This does not end the stream, but it simply discards
the event collection, making `handle.resume()` a no-op.

#### handle.resume()

Resume the stream by re-emitting all the `data` events in the same order,
followed by an `end` event, if that was emitting during the pause.

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/pause.svg
[npm-url]: https://npmjs.org/package/pause
[node-image]: https://img.shields.io/node/v/pause.svg
[node-url]: http://nodejs.org/download/
[travis-image]: https://img.shields.io/travis/stream-utils/pause/master.svg
[travis-url]: https://travis-ci.org/stream-utils/pause
[coveralls-image]: https://img.shields.io/coveralls/stream-utils/pause.svg
[coveralls-url]: https://coveralls.io/r/stream-utils/pause?branch=master
[downloads-image]: https://img.shields.io/npm/dm/pause.svg
[downloads-url]: https://npmjs.org/package/pause

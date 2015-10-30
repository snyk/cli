# Autocache

[![Travis Status](https://travis-ci.org/remy/autocache.svg?branch=master)](https://travis-ci.org/remy/autocache)

**TL;DR memorisation back by a persistent store.**

Instead of caching single keys and values, autocache allows you to define a setter and when a request for that key is placed, it will run the setter live, caching the result and returning it.

Importantly, the autocache can, *and should* be used with a persistent store so long as the adapter implements the [storage api](#storage-api).

Note that by default, the cache is stored in memory (which kinda isn't the point), so when you restart, the cache will be lost.

## Usage

Autocache can be used either on the server or on the client (again, recommended with a persistent adapter).

General usage:

- Define a storage proceedure against a `key`
- Get the key value
- Clear/invalidate values

Note that autocache is a singleton, so we only need to set the store once.

```js
var redisAC = require('autocache-redis');
var cache = require('autocache')({ store: redisAC });

cache.define('testStatus', function (done) {
  // call an imaginary test status API
  http.request('/test-status').then(function (result) {
    done(null, result.status);
  }).catch(function (error) {
    done(error);
  });
});
```

...now in another script elsewhere:

```js
var cache = require('autocache');

app.get('/status', function (req, res) {
  cache.get('testStatus', function (error, status) {
    if (error) {
      return res.send(error);
    }

    res.render(status === 'pass' ? 'test-passing' : 'test-fail');
  });
});

// every 10 minutes, clear the cache
// note: we could also do this using the object notation and the TTL property
setInterval(function () {
  cache.clear('testStatus');
}, 10 * 60 * 1000);
```

## Adapters

Current adapters:

* [Redis](https://www.npmjs.com/package/autocache-redis)
* [localStorage](https://www.npmjs.com/package/autocache-localstorage)

Please do contribute your own adapters - missing: mongodb, memcache, sqlite..?

## Methods

### cache.define(string, function)

For a particular `string` key, set a function that will return a cached value.

Note that the `function` can be synchronous or asynchronous. If your code accepts a `done` function, you can pass the value you wish to cache to the `done` function argument (as seen in the usage example above).

### cache.define(options)

As above, but with extended options:

```js
{
  name: "string",
  update: function () {},
  ttl: 1000, // time to live (ms)
  ttr: 1000, // time to refresh (ms)
}
```

TTL will auto expire (and `clear`) the entry based on the `ttl` milliseconds since the last time it was *accessed*.

Note that if `ttr` is present, `ttl` will be ignored.

### cache.get(string, function)

If a cached value is available for `string` it will call your `function` with an error first, then the result.

If there is no cached value, autocache will run the definition, cache the value and then call your `function`.

If multiple calls are made to `get` under the same `string` value, and the value hasn't been cached yet, the calls will queue up until a cached value has been returned, after which all the queued `function`s will be called.

### cache.get(string, [fn args], function)

Cache getting also supports arguments to your definition function. This is *only* supported on async definitions.

For example:

```js
cache.define('location', function (name, done) {
  xhr.get('/location-lookup/' + name).then(function (result) {
    done(null, result);
  }).catch(function (error) {
    done(error);
  });
});

// this will miss the cache, and run the definition
cache.get('location', 'brighton', function (error, data) {
  // does something with data
});

// this will ALSO miss the cache
cache.get('location', 'berlin', function (error, data) {
  // does something with data
});

// this will hit the cache
cache.get('location', 'berlin', function (error, data) {
  // does something with data
});
```

In the above example, once the cache is called with the argument `brighton`, the name and argument are now the unique key to the cache.

### cache.update(string, function)

Calls the definition for the `string`, caches it internally, and calls your `function` with and error and the result.

### cache.clear([string])

Clear all (with no arguments) or a single cached entry.

### cache.destroy([string])

Destroy the all definitions (with no arguments) or a single definition entry.

### cache.configure({ store: adapter })

Set and store the storage adapter for persistent storage. See notes on [adapters](#apaters).

### cache.reset()

Clear all of the internal state of the cache, except for the storage adapter.

## Storage API

If you want to write your own adapter for persistent storage you must implement the following functions:

```text
get(key<string>, callback<function>)
set(key<string>, value<string>, callback<function>)
destroy([key<string>])
clear()
```

See the [adapters](https://github.com/remy/autocache/tree/master/adapters) for examples of code.

Notes:

1. Callbacks must pass an error first object, then the value. The value should be `undefined` if not found.
2. Callbacks are expected to be asynchronous (but are acceptable as synchronous).
3. `clear` should only clear objects created by the cache (which can be identified by a prefix).
4. Calling the adapter function should accept the `autocache` as an argument, example below.
5. Autocache will handle converting user objects to and from JSON, so the adapter will always be storing a string.

**Important** once your adapter has been attached, it should emit a `connect` event:

```js
// this tells autocache that we're reading to start caching
autocache.emit('connect');
```

### Automatically setting the autocache store

When the adapter is required, the user must be able to pass the autocache object into your adapter. This call will set the autocache's store to your adapter.

Below is the code from the `localStorage` adapter. It returns the store if called, but also checks if the autocache was passed in, and if it was, calls the `configure` function to assign the store as itself:

```js
function LocalStore(autocache) {
  if (autocache) {
    autocache.configure({ store: new LocalStore() });
    return LocalStore;
  }
}
```

## TODO

- Test prefix support

## License

[MIT](http://rem.mit-license.org)
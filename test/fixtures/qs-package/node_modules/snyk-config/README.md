# snyk-config

Loads the configuration for your module.

## Usage

Although you can require this module directly, it's recommended you create your own `config.js` file that can be cached by the require system and called *without* a path:

```js
// config.js
module.exports = require('@snyk/config')('<directory with config files>');

// in app.js
var config = require('./config');

// in foo.js
var config = require('./config'); // matches config in app.js
```

## Method

The config loader will look for the following values in order of priority, specifically, if a property appears in multiple layers of config (below) the first found is used:

- process environment values prefixed with `SNYN_`
- process arguments
- a `config.local.json` file in the root of your module
- a `config.default.json` file in the root of your module

## Example

### config.local.json

```json
{
  "from": "file"
}
```

### app.js

```js
// as we're in the same directory as the config.local.json, there's no arg
var config = require('@snyk/config')();
console.log(config);
```

### cli

```shell
$ SNYK_from=cli node app.js
=> { from: "cli" }
```

## Notes

* Values read from the environment or from the process arguments will *always* be strings. This is important to differentiate from values parsed in the config files as these can be `boolean` or `numbers`.
* Environment property names strip *off* the preceding `SNYK_` string, so `SNYK_foo = 10` becomes `foo = "10"`
* To create a nested object structure from the environment values, use two underscores: `SNYK__foo__bar = 10` becomes `foo = { bar: "10" }`
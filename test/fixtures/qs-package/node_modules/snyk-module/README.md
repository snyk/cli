# snyk/module


[![Build Status](https://travis-ci.org/Snyk/module.svg?branch=master)](https://travis-ci.org/Snyk/module) [![Coverage Status](https://coveralls.io/repos/Snyk/module/badge.svg?branch=master&service=github)](https://coveralls.io/github/Snyk/module?branch=develop)

Parses a string module name into an object, and tests for Snyk support.

See [tests](https://github.com/Snyk/module/blob/4a1055822a33b4294bd28e3502135e1153c06a46/test/index.test.js) for examples.

## Testing manually

You can use this module from the terminal whilst inside the root of the repo directory:

```bash
$ node . foo@3
{ name: "foo", version: 3 }
```
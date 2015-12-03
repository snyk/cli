# snyk/module

Parses a string module name into an object, and tests for Snyk support.

See [tests](https://github.com/Snyk/module/blob/4a1055822a33b4294bd28e3502135e1153c06a46/test/index.test.js) for examples.

Note that at this time the following are not supported in Snyk:

- Private npm modules
- External modules, i.e. those loaded over http or git
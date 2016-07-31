# snyk-resolve-deps

This package will create a virtual tree representation of a node package's dependencies, supporting *both* npm@2 and npm@3 directory structures.

Note that the output differs from the `npm ls` output in that deduped packages are resolved to their owners.

## Programatical usage

```js
var resolveDeps = require('snyn-resolve-deps');
var asTree = require('snyk-tree');

resolveDeps(process.cwd(), { dev: true }).then(function (tree) {
  console.log(asTree(tree));
}).catch(function (error) {
  // error is usually limited to unknown directory
  console.log(error.stack);
  process.exit(1);
});
```

## CLI usage

Note that the installed module name differs from the CLI tool (no `-deps` on the end).

```bash
$ npm install -g snyk-resolve-deps
$ snyk-resolve path-to-node-project
```

The CLI also supports the `--dev` (or `-d`) flag to include dev dependencies and an optional `--json` to show the output as JSON instead of the ascii tree.

## How it works

To fully support npm@2 and npm@3 two passes of the tree are required:

### 1. The physical pass on the directory structure

The module will start by reading the `package.json` from the target directory, capture the metadata and then read through each recursive `node_modules` directory.

This creates the `physicalTree` object. In npm@3 this will usually yield an object with the root metadata (name, version, etc) and then a `dependencies` object that contains *every* dependency across the entire code base. This is not the true representation of the package relationships so we need to make the second pass.

There are also edge cases that need to be handled, particularly when a dev or prod dependency hasn't been loaded into the physical tree because it has been missed. This can be either because the package is missing from the project, or (more likely) because the dependencies is much higher up and outside of the original directory that was scanned. So a second check is run to find those missing modules, using the [snyk-resolve](https://www.npmjs.com/package/snyk-resolve) module.

*Note: code found in `lib/deps.js`*

### 2. The virtual pass using package metadata

The next pass uses the `physicalTree` as the starting point, but uses the `dependencies` and `devDependencies` properties from the `package.json` metadata. It will iterate through the dependencies and resolve the correct dependency package from the physical tree based on similar methods that the `require` module loading system will use (this is in `lib/pluck.js`).

Finally, once the virtual tree is constructed, a pass is made to check for unused packages from the original `physicalTree`, which are marked as `extraneous: true`, and if the optional `dev` flag is `false`, all `devDependencies` are stripped.

*Note: code found in `lib/logical.js`*

## Misc

* [CONTRIBUTING.md](CONTRIBUTING.md)
* [License: Apache License, Version 2.0](LICENSE)
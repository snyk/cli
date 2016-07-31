# clite

A CLI lite framework for your node CLI utilities. Provides basic routine functionality that you don't want to write yourself. Pronounced: *slight*.

[![Build Status](https://travis-ci.org/remy/clite.svg)](https://travis-ci.org/remy/clite) [![Donate](https://img.shields.io/badge/support-%20%E2%9D%A4%20-56c838.svg)](https://www.paypal.me/rem)

## Features

- **version**: echo's current `package.json` version, or if omitted (if you're using [semantic-release](https://www.npmjs.com/semantic-release)) will echo the current branch & commit
- **help**: simplifies loading and reading help files
- **stdin**: automatically detects bodies on stdin and passes it as an argument to your code
- **update notification**: uses [update-notifier](https://www.npmjs.com/update-notifier) to automatically notify your users of an update to your CLI tool
- on exceptions, will echo the error and quit with a non-zero exit code
- automatically creates aliases for all your CLI commands and options using [abbrev](https://www.npmjs.com/package/abbrev)
- supports boolean flags, options and aliases using [yargs](https://www.npmjs.org/yargs)
- promise based (note that promises are polyfilled in node < 4, using [es6-promise](https://www.npmjs.com/es6-promise))
- command modules are lazy loaded, which reduces boot and exit time in your CLI tool

## Usage

After `npm install --save clite` to your project, the simplest CLI script contains:

```js
#!/usr/bin/env node
var clite = require('clite');
clite(require('./config'));
```

The config drives how your code is run from the CLI. Note that by default, clite expects your code to return a string (which will be echo'ed on `STDOUT`) or throw an error that also echos the `error.message` on `STDERR`.

## Debugging

To see more details on what clite is parsing and see any stacktraces inside of clite, use the `DEBUG=clite` env value:

```bash
DEBUG=clite <your-demo-app>
```

## Return objects in commands (and async use)

Your command modules are called inside of promises. The clite framework expects a `string` to be returned out of the promises to be printed on `STDOUT`.

If your command needs to make use of asnychonous programming, return a promise, and resolve the promise with a string. For example:

```js
module.exports = function echoLater(args) {
  return new Promise(resolve =>
    setTimeout(() => resolve('All done'), 1000)
  );
};
```

## Config

The configuration is made up of the following properties:

- commands: a map of CLI arguments to JavaScript files
- booleans: an array of arguments you wish to accept as boolean values
- options: an array of arguments you wish to accept as strings (or numbers)
- alias: a map of alias keys (the CLI alias) and values (the real value)
- help: either a filename, or a map of keys and values to text filenames
- return: defaulted to false, returns all values, errors included, to user code (by default exceptions cause a `process.exit(1)`)

**Important**: all filenames (for help and commands) are relative to the root of your package.json file.

For `commands` and `help`, a special key of `_` that is used if no argument is given (i.e. your user runs your CLI utility without any arguments).

A sample config can be seen in the [example](#example) section below.

## Commands

The commands are the mapping from the CLI argument to your scripts. An example `commands` in the config could be:

```js
module.exports = {
  commands: {
    '_': 'lib/index',
    'publish': 'lib/publish',
    'search': 'lib/search',
    'new': 'lib/create-new-post'
  },
  // snip
```

Although clite uses promises, your code does not need to use them (but you can if chose to), however, if you `throw` an error, this will echo to the terminal and `exit(1)` the program. The commands modules receive three arguments:

- `args`: an object of the fully parsed CLI arguments, all command arguments are stored in `args._` as an array (note that the array only contains all the remaining args not matched to flags or commands)
- `settings`: the configuration of clite (including defaults)
- `body`: the body of text if content was piped via `STDIN`

For example, `lib/create-new-post` could contain:

```js
module.exports = (args, settings, body) => {
  if (body) {
    // create the post in the db
    return new Post({
      body,
      title: args._[0]
    }).save().then(r => `Successfully created ${r.id}`);
  }
};

// called using `cat post.md | my-cli-tool new "Awesome Post Title"
```

This also assumes that your bin script is using `.then(console.log)` to redirect responses to the terminal. Of course, you don't have to do that, you can handle printing to the terminal as you please.

## Example

Directory structure:

```text
clite-demo
├── cli
│   ├── config.js
│   └── index.js
├── help
│   ├── help.txt
│   └── setup.txt
├── lib
│   ├── search.js
│   ├── publish.js
│   ├── create-new-post.js
│   └── index.js
├── node_modules
│   └── clite <snip>
└── package.json
```

Snippet of `package.json`:

```json
{
  "name": "clite-demo",
  "main": "lib/index.js",
  "dependencies": {
    "clite": "^1.0.0"
  },
  "bin": {
    "clite-demo": "cli/index.js"
  }
}
```

Contents of `cli/index.js` (which is linked to the bin file `clite-demo`):

```js
#!/usr/bin/env node
var clite = require('clite');
clite(require('./config')).then(console.log);
```

Contents of `cli/config.js`:

```js
module.exports = {
  commands: {
    '_': 'lib/index',
    'publish': 'lib/publish',
    'search': 'lib/search',
    'new': 'lib/create-new-post'
  },
  option: [
    'grep',
    'count',
  ],
  flag: [
    'debug',
    'json'
  ],
  help: {
    _: 'help/help.txt',
    setup: 'help/setup.txt'
  },
};
```

**Important note:** where `_` is used, this is the fallback for if the user has not specified a value for a particular command. If the default is not found, clite will revert to loading "`.`" (aka the index of package directory).

## FAQTIMU

Frequently asked questions...that I made up:

### I see `undefined` at the end of the output

This is because clite is logging out your content, then your code is including a final log, such as:

```js
clite(require('./config')).then(console.log);
```

To fix this, remove the final `.then(console.log)`.

### Can I get the original CLI arguments?

The original CLI args is on `process.argv`, if you want everything that wasn't a boolean or an option, then this is in the command's `arg.argv` - which is usually the same as `arg._` except doesn't contain the path to `node`, the script that ran the code and if a command was matched, that command.

## Feedback, filing issues & pull requests

Please see the [contributing](https://github.com/remy/clite/blob/master/.github/CONTRIBUTING.md) for guidelines. All feedback is welcome ❤

## License

MIT / http://rem.mit-license.org
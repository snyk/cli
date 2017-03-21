![Snyk logo](https://snyk.io/style/asset/logo/snyk-print.svg)

***

[![Known Vulnerabilities](https://snyk.io/test/npm/snyk/badge.svg)](https://snyk.io/test/npm/snyk)

Snyk helps you find, fix and monitor for known vulnerabilities in Node.js npm, Ruby and Java dependencies, both on an ad hoc basis and as part of your CI (Build) system.

## Documentation

[Full documentation is available on snyk.io](https://snyk.io/docs/using-snyk/?utm_campaign=docs&utm_medium=github&utm_source=full_docs)


## Installation

1. Install the Snyk utility using `npm install -g snyk`.
2. Once installed you will need to authenticate with your Snyk account: `snyk auth`

For more detail on how to authenticate take a look at the [CLI authentication](https://snyk.io/docs/using-snyk#authentication?utm_campaign=docs&utm_medium=github&utm_source=CLI_authentication) section of the Snyk documentation. 

## CLI

```console
snyk [options] [command] [package]
```

Run `snyk --help` to get a quick overview of all commands or for full details on the CLI read the snyk.io [CLI docs](https://snyk.io/docs/using-snyk?utm_campaign=docs&utm_medium=github&utm_source=cli). 

The package argument is optional. If no package is given, Snyk will run the command against the current working directory allowing you test you non-public applications.


## Features
- **Find** known vulnerabilities by running `snyk test` on a project either as a one off or as part of your CI process.
- **Fix** vulnerabilities using `snyk wizard` and `snyk protect`. 
	- `snyk wizard` walks you through finding and fixing know vulnerabilities in your project. Remidiation options include configuring your policy file to update, auto patch and ignore vulnerabilities. (npm only) 
	- `snyk protect` your code from vulnerabilities by applying patches and optionally suppressing specific vulnerabilities.
- **Alert** `snyk monitor` records the state of dependencies and any vulnerabilities on snyk.io so you can be alerted when new vulnerabilities or updates/patches are disclosed that affect your repositories.
- **Prevent** new vulnerable dependencies from being added to your project by running `snyk test` as part of your CI to fail tests when vulnerable Node.js or Ruby dependencies are added.


## Build

If using this package from the repo directly, you'll need to first build the custom lodash by running:
```
npm run build
```
This will create a `dist` directory with the minimal lodash file.
When using the package via npm, the build is not needed as the `dist` directory is already included in the npm package.


## Badge

Once you’re vulnerability free, you can put a badge on your README showing your package has no known security holes. This will show your users you care about security, and tell them that they should care too.

If there are no vulnerabilities, this is indicated by a green badge.

[![Known Vulnerabilities](https://snyk.io/package/npm/name/badge.svg)](https://snyk.io/package/npm/name)

If vulnerabilities have been found, the red badge will show the number of vulnerabilities.

[![Known Vulnerabilities](https://snyk.io/package/npm/jsbin/badge.svg)](https://snyk.io/package/npm/jsbin)

Get the badge by copying the relevant snippet below and replacing "name" with the name of your package.

HTML:

```
<img src="https://snyk.io/package/npm/name/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/package/npm/name style="max-width:100%;">
```

Markdown:

```
[![Known Vulnerabilities](https://snyk.io/package/npm/name/badge.svg)](https://snyk.io/package/npm/name)
```


[![Analytics](https://ga-beacon.appspot.com/UA-69111857-2/Snyk/snyk?pixel)](https://snyk.io/)

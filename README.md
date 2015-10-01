# Snyk

Available for private beta testing.

## Installation

Since snyk isn't publicly available in npm yet, you will need to clone this repo and link a local copy of snyk.

A prerequisite of snyk is to have [nodejs](https://nodejs.org) (and npm - included) installed.

Once you have node, you should follow these step to use snyk locally:

```shell
git clone git@github.com:Snyk/snyk.git
cd snyk
npm link --production
npm install
snyk version   # ... should echo "development"
```

Note that you will need to use snyk under the cli to authenticate, but you do not necessarily need to use snyk as a library in your projects.

## Using snyk

You will first need to authenticate with snyk before being able to use any of it's features. This is a requirement during private beta. Once in public beta, some functions are available without auth.

To auth, you will need a github account and run `snyk auth` and follow the on screen instructions.

Once authed, you can use the two snyk commands:

- `snyk test`
- `snyk monitor`

## test

```shell
# example uses
snyk test
snyk test express@3.x
snyk test lodash
```

Using `snyk test` without an argument will test the current working directory and walk the local dependencies and installed versions. It will then give you a report on whether there are any known vulnerabilities in those dependencies and suggest any remediation you can take.

The test command also takes a package and version as an argument. So if you wanted to test a module you don't have locally, you can `snyk test module[@semver-range]`.

If there are vulnerabilities, the process with exit with a non-zero exit code - so that you can use this as part of your CI tests.

## monitor

...
# Snyk - so now you know

Available for private beta testing. Currently available for nodejs projects. More language support is coming soon.

Snyk will inform you of vulnerabilities in your projects, can be used as part of you continuous integration and can be used to monitor all your dependencies (and their dependencies) for future vulnerabilities.

## Installation

The Snyk CLI tool is installed via npm. First you need to install [nodejs](https://nodejs.org) which includes npm as part of the installation. Once complete, from your terminal, run the following command:

```shell
npm install -g snyk
```

You now have `snyk` installed as a CLI utility, and are ready to `auth` and use Snyk in your workflow.

## Using snyk

You will first need to authenticate with snyk before being able to use any of it's features. This is a requirement during private beta. Once in public beta, `test` and `protect` will be available without the need to `auth`.

To authenticate, you will need a GitHub account and run `snyk auth` and follow the on screen instructions.

Once authenticated, you can use the following commands:

- `snyk test`
- `snyk protect`
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

## protect

Snyk can help you resolve any existing vulnerabilities in your system.

Snyk's protect functionality allows you to patch vulnerabilities that can't be remediated through an upgrade (*currently not available in private beta*) or ignore specific vulnerabilities.

In `interactive` mode, `snyk protect --interactive` will also prompt you when an vulnerability can be remediated via a package update. For instance, if there is a vulnerability in package `Z@0.0.1` which is in a deep dependency of package `A@1.0.0` (used in your project), then `snyk protect --interactive` will discover the remediation patch and suggest you upgrade to package `A@1.3.0` which resolves the deep dependency `Z` outside of the vulnerability range.

If you chose to ignore a vulnerability, your choice will be saved in a `.snyk` YAML file and the vulnerability will be ignored for 30 days (by default).

It's highly recommend you run `snyk protect --interactive` on your project directory if `snyk test` yields and vulnerabilities.

## monitor

From your project directory, use the `monitor` functionality to take a snapshot of all the dependencies (and their dependencies). Those dependencies will be tracked for vulnerabilities in the future and you will be notified if a vulnerability emerges.

```shell
# example uses
cd ~/dev/acme-project
snyk monitor
# a snyk.io monitor response URL is returned
```

## appendix

Vulnerabilities are (currently) sourced from the Node Security Project.
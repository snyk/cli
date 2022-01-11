# snyk auth -- authenticate Snyk CLI with a Snyk account

## Usage

`snyk auth [<API_TOKEN>] [<OPTIONS>]`

## Description

The `snyk auth` command authenticates the Snyk CLI with a Snyk account. Running `$ snyk auth` without an `<API_TOKEN>` opens a browser window and asks you to log in to your Snyk account and authorize.

In a CI/CD environment, use `<API_TOKEN>`; see [Authenticate the CLI with your account](https://docs.snyk.io/features/snyk-cli/authenticate-the-cli-with-your-account).

## Debug

Use the `-d` option to output the debug logs.

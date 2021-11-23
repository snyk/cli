# snyk auth -- Authenticate Snyk CLI with a Snyk account

## Usage

`snyk auth [<API_TOKEN>] [<OPTIONS>]`

## Description

Authenticate Snyk CLI with a Snyk account. Running `$ snyk auth` without an `<API_TOKEN>` will open a browser window and asks you to login with Snyk account and authorize. When inputting an `<API_TOKEN>`, it will be validated with Snyk API.

When running in a CI environment `<API_TOKEN>` is required.

## Options

### `<API_TOKEN>`

Your Snyk token. May be an user token or a service account.<br />
[How to get your account token](https://snyk.co/ucT6J)<br />
[How to use Service Accounts](https://snyk.co/ucT6L)<br />

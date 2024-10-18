# Auth

## Usage

`snyk auth [<API_TOKEN>] [<OPTIONS>]`

## Description

The `snyk auth` command authenticates your machine to associate the Snyk CLI with your Snyk account.

Running `$ snyk auth` opens a browser window with prompts to log in to your Snyk account and authenticate. No repository permissions are needed at this stage, only your email address.

When you have authenticated, you can start using the CLI; see [Getting started with the CLI](https://docs.snyk.io/snyk-cli/getting-started-with-the-cli)

**Note:** Beginning with version 1.1293, the Snyk CLI uses OAuth when authenticating through the browser.

OAuth provides improved security by issuing shorter-lived expiring authorizations with the convenience of automatic refresh.

Earlier versions of the Snyk CLI (< 1.1293) obtained a non-expiring API token through a legacy browser interaction.

The Snyk API token can still be used as a fallback option. You must explicitly add an option to enable it as follows: `snyk auth --auth-type=token`.

## Options

### `--auth-type=<TYPE>`

Specify the \<TYPE> of authentication to use. Supported types are `oauth` (the default beginning with version 1.1293.0) AND `token`.

### `--client-secret=<SECRET>` and `--client-id=<ID>`

You can set the client secret and the id can be set in order to use the [OAuth2 Client Credentials Grant](https://docs.snyk.io/enterprise-configuration/service-accounts/service-accounts-using-oauth-2.0#oauth-2.0-with-client-secret)

Both values must be provided together. They are only valid together with `--auth-type=oauth;`otherwise they will be ignored.&#x20;

For information about how to get the `<SECRET>` and the `<ID>`, see [Service accounts using OAuth 2.0](https://docs.snyk.io/enterprise-setup/service-accounts/service-accounts-using-oauth-2.0#oauth-2.0-with-client-secret)

## Token value

In some environments and configurations, you must use the `<API_TOKEN>`; see [Authenticate the CLI with your account](https://docs.snyk.io/snyk-cli/authenticate-the-cli-with-your-account)

The value may be a user token or a service account token; see [Service accounts](https://docs.snyk.io/enterprise-setup/service-accounts)

In a CI/CD environment, use the `SNYK_TOKEN` environment variable; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

After setting this environment variable, you can use CLI commands.

## Debug

Use the `-d` option to output the debug logs.

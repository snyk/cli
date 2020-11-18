## ENVIRONMENT

You can set these environment variables to change CLI run settings. These keys will override settings in your `snyk config`:

- `SNYK_TOKEN`:
  Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

  [How to get your account token](https://snyk.co/ucT6J)<br />
  [How to use Service Accounts](https://snyk.co/ucT6L)<br />

- `SNYK_API`:
  Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies.

- `SNYK_CFG_`<KEY>:
  Allows you to override any key that's also available as `snyk config` option.

  E.g. `SNYK_CFG_ORG`=myorg will override default org option in `config` with "myorg".

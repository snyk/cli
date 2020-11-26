## ENVIRONMENT

You can set these environment variables to change CLI run settings.

- `SNYK_TOKEN`:
  Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

  [How to get your account token](https://snyk.co/ucT6J)<br />
  [How to use Service Accounts](https://snyk.co/ucT6L)<br />

- `SNYK_API`:
  Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies.

- `SNYK_CFG_`<KEY>:
  Allows you to override any key that's also available as `snyk config` option.

  E.g. `SNYK_CFG_ORG`=myorg will override default org option in `config` with "myorg".

- `SNYK_REGISTRY_USERNAME`:
    Specify a username to use when connecting to a container registry. Note that using the `--username` flag will
     override this value. This will be ignored in favour of local Docker binary credentials when Docker is present. 
  
- `SNYK_REGISTRY_PASSWORD`:
    Specify a password to use when connecting to a container registry. Note that using the `--password` flag will
     override this value. This will be ignored in favour of local Docker binary credentials when Docker is present. 
    

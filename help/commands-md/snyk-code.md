# snyk-code(1) -- Find security issues using Static code analysis scanning

## SYNOPSIS

`snyk` `code` \[<COMMAND>\] \[<OPTIONS>\] <PATH>

## DESCRIPTION

Find security issues using Static code analysis scanning

[For more information see snyk code help page](https://snyk.co/<snyk-code-docs-should-be-here>)

## COMMANDS

- `test`:
  Test for any known issue.

## OPTIONS

- `--severity-threshold`=low|medium|high|critical:
  Only report configuration issues with the provided severity level or higher. Please note that the Snyk Code configuration issues do not currently use the `critical` severity level.

- `--json`:
  Prints results in JSON format.

- `--org`=<ORG_NAME>:
  Specify the <ORG_NAME> to run Snyk commands tied to a specific organization. This will influence private tests limits.
  If you have multiple organizations, you can set a default from the CLI using:

  `$ snyk config set org`=<ORG_NAME>

  Setting a default will ensure all newly tested projects will be tested
  under your default organization. If you need to override the default, you can use the `--org`=<ORG_NAME> argument.
  Default: uses <ORG_NAME> that sets as default in your [Account settings](https://app.snyk.io/account)

- `--sarif`:
  Return results in SARIF format.




### Flags available accross all commands

- `--insecure`:
  Ignore unknown certificate authorities.

- `-d`:
  Output debug logs.

- `--quiet`, `-q`:
  Silence all output.

- `--version`, `-v`:
  Prints versions.

- \[<COMMAND>\] `--help`, `--help` \[<COMMAND>\], `-h`:
  Prints a help text. You may specify a <COMMAND> to get more details.




## EXIT CODES

Possible exit codes and their meaning:

**0**: success, no vulns found<br />
**1**: action_needed, vulns found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />


## ENVIRONMENT

You can set these environment variables to change CLI run settings.

- `SNYK_TOKEN`:
  Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

  [How to get your account token](https://snyk.co/ucT6J)<br />
  [How to use Service Accounts](https://snyk.co/ucT6L)<br />

- `SNYK_CFG_KEY`:
  Allows you to override any key that's also available as `snyk config` option.

  E.g. `SNYK_CFG_ORG`=myorg will override default org option in `config` with "myorg".

- `SNYK_REGISTRY_USERNAME`:
  Specify a username to use when connecting to a container registry. Note that using the `--username` flag will
  override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

- `SNYK_REGISTRY_PASSWORD`:
  Specify a password to use when connecting to a container registry. Note that using the `--password` flag will
  override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

## Connecting to Snyk API

By default Snyk CLI will connect to `https://snyk.io/api/v1`.

- `SNYK_API`:
  Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies. If set with `http` protocol CLI will upgrade the requests to `https`. Unless `SNYK_HTTP_PROTOCOL_UPGRADE` is set to `0`.

- `SNYK_HTTP_PROTOCOL_UPGRADE`=0:
  If set to the value of `0`, API requests aimed at `http` URLs will not be upgraded to `https`. If not set, the default behavior will be to upgrade these requests from `http` to `https`. Useful e.g., for reverse proxies.

- `HTTPS_PROXY` and `HTTP_PROXY`:
  Allows you to specify a proxy to use for `https` and `http` calls. The `https` in the `HTTPS_PROXY` means that _requests using `https` protocol_ will use this proxy. The proxy itself doesn't need to use `https`.


## NOTICES

### Snyk API usage policy

The use of Snyk's API, whether through the use of the 'snyk' npm package or otherwise, is subject to the [terms & conditions](https://snyk.co/ucT6N)


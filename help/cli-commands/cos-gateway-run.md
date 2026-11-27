# COS gateway run

## Usage

`snyk cos gateway run [<OPTIONS>]`

## Description

The `snyk cos gateway run` command runs a gateway in the foreground until it is stopped with Ctrl+C or SIGTERM. It keeps the gateway registered with Snyk and carries scan traffic to the targets that the host can reach.

The gateway authenticates with the node token that [`snyk cos gateway create`](cos-gateway-create.md) prints. Provide the token in one of these ways, but not both:

- Set the `SNYK_GATEWAY_TOKEN` environment variable.
- Use the `--token-file` option.

The node token is the only credential. You do not need `snyk auth`, `SNYK_TOKEN`, or `--tenant-id`, and the gateway never sends your Snyk login.

The gateway connects to a Snyk API, which must be the API of the account that created the gateway. It uses `SNYK_API` when that variable is set, even if the CLI is logged in to another API. Otherwise, if the CLI is logged in, it uses the login's API. If the CLI is not logged in, it uses the region set with `snyk config environment`. The default is SNYK-US-01 (`https://api.snyk.io`).

Behind a TLS-inspecting proxy, set `NODE_EXTRA_CA_CERTS` to the proxy's CA bundle, as for the rest of the Snyk CLI.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, the gateway stopped after Ctrl+C or SIGTERM\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--token-file=<PATH>`

Optional. The path to a file that contains the node token. Leading and trailing whitespace is trimmed. Use this option instead of the `SNYK_GATEWAY_TOKEN` environment variable. If you set both, the command fails.

Example, with the token in the `SNYK_GATEWAY_TOKEN` environment variable:

```bash
$ export SNYK_GATEWAY_TOKEN=<TOKEN>
$ snyk cos gateway run
```

Example, with the token in a file:

```bash
$ snyk cos gateway run --token-file=<PATH>
```

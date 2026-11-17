# COS gateway run

## Usage

`snyk cos gateway create [<OPTIONS>]`

## Description

The `snyk cos gateway run` command runs a gateway in the foreground until it is stopped with Ctrl+C or SIGTERM. It keeps the gateway registered with Snyk and carries scan traffic to the targets that the host can reach.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway successfully started\
**3**: failure, configuration file not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--`SNYK_GATEWAY_TOKEN`=<TOKEN>`

**Required**. The token to run the gateway

Example:

```bash
$ snyk cos gateway run --SNYK_GATEWAY_TOKEN=<TOKEN>
```

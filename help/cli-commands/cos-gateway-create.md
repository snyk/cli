# COS gateway create

## Usage

`snyk cos gateway create [<OPTIONS>]`

## Description

The `snyk cos gateway create` command creates a gateway and prints its ID, name, and state, followed by its node token.

The node token is the credential that the gateway process uses to authenticate its tunnel. **The token is shown once.** The service does not store it and cannot return it again. If you lose the token, delete the gateway and create another.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: gateway created successfully\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--name=<NAME>`

**Required**. Specify the display name of the gateway.

Example:

```bash
$ snyk cos gateway create --name=dc4-singapore
```

### `--json`

Output the gateway as JSON, including `node_token`.

Example:

```bash
$ snyk cos gateway create --name=dc4-singapore --json
```

### `--tenant-id=<TENANT_ID>`

Specify the tenant ID. Auto-discovered if not provided.

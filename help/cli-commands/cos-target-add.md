# COS target create

## Usage

`snyk cos target create [<OPTIONS>]`

## Description

The `snyk cos target create` command creates a target from a YAML configuration file.

For a sample configuration file you can copy and adapt, visit [COS target template](cos-target-template.md)

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Exit codes

Possible exit codes and their meaning:

**0**: target created successfully\
**2**: failure, primary URL unreachable\
**3**: failure, configuration file not found

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--config=<CONFIG>`

**Required**. Specify the path to the target YAML configuration file.

Example:

```bash
$ snyk cos target create --config=acme.yaml
```

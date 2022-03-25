# IAC gen-driftignore

## Usage

`snyk iac gen-driftignore [<OPTIONS>]`

## Description

The `snyk iac gen-driftignore` command generates driftignore rules to be used by `snyk iac test`.

See also the help for [`iac test`](https://docs.snyk.io/snyk-cli/commands/iac-test) and [`iac describe`](https://docs.snyk.io/snyk-cli/commands/iac-describe)``

For more information see [Ignore resources](https://docs.snyk.io/products/snyk-infrastructure-as-code/detect-drift-and-manually-created-resources/ignore-resources).

## Exit codes

Possible exit codes and their meaning:

**0**: success, driftignore generated successfully\
**1**: error, something wrong happened during ignore file generation

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--input`

Input from which the JSON should be parsed.

Default: stdin

Example:

```
$ snyk iac gen-driftignore --input=output.json --output=/dev/stdout
```

### `--output=<OUTPUT_FILE_PATH>`

Output file path to which to write the driftignore.

Default: `.driftignore`

Example:

```
$ snyk iac describe --output=json://output.json
```

### `--exclude-changed`

Exclude resources that changed on cloud provider.

### `--exclude-missing`

Exclude missing resources.

### `--exclude-unmanaged`

Exclude resources not managed by IaC.

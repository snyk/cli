# IaC rules repl

## Usage

**Feature availability:** This feature is in Early Access.

`snyk iac rules repl [<OPTIONS>]`

## Description

The `snyk iac rules repl` command starts an interactive Rego REPL for an IaC custom rules project.

Run the command from an IaC custom rules project directory. You can load an input file and run initialization commands when the REPL starts.

For a list of related commands run `snyk iac --help`.

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--repl-init=<COMMAND>`

Run commands on REPL initialization.

This option can be provided more than once.

### `--repl-input=<FILE_PATH>`

Load an IaC input file into the REPL.

## Example

Start the REPL with an input file:

```
snyk iac rules repl --repl-input=input.json
```

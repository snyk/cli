# IaC rules push

## Usage

**Feature availability:** This feature is in beta.

`snyk iac rules push [<OPTIONS>]`

## Description

The `snyk iac rules push` command bundles rules written in Rego and uploads changes to the Snyk platform.

For a list of related commands run `snyk iac --help`

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--delete`

Delete a previously-pushed bundle from an Organization. The Organization can be manually overridden by using the `--org` flag.

## Examples for snyk iac rules push command

### Bundle and upload a new bundle

```
$ snyk iac rules push
```

### Delete a bundle

```
$ snyk iac rules push --delete
```

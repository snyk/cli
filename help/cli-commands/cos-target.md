---
description: Use the snyk cos target commands to create, inspect, and export targets.
---

# COS target

## Usage

`snyk cos target [<COMMAND>] [<OPTIONS>]`

## Description

The `snyk cos target` command creates, inspects, and exports targets. Targets represent the applications you want to scan.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Commands

- [`snyk cos target add`](cos-target-add.md), `snyk cos target add --help`: create a target from a configuration file
- [`snyk cos target list`](cos-target-list.md), `snyk cos target list --help`: list all targets
- [`snyk cos target show`](cos-target-show.md), `snyk cos target show --help`: show the details of a target
- [`snyk cos target dump`](cos-target-dump.md), `snyk cos target dump --help`: export a target as YAML

For a sample configuration file to use with `snyk cos target add`, visit [COS target template](cos-target-template.md)

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

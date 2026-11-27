# COS gateway

## Usage

`snyk cos gateway [<COMMAND>] [<OPTIONS>]`

## Description

The `snyk cos gateway` allows you to manage gateways. A gateway is an agent you run inside your network so that scans can reach private targets: private addresses and internal or single-label names such as `jira.corp` or `intranet`, resolved by the gateway in its network.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Commands

- [`snyk cos gateway create`](cos-gateway-create.md), `snyk cos gateway create --help`: create a new gateway
- [`snyk cos gateway list`](cos-gateway-list.md), `snyk cos gateway list --help`: list all gateways
- [`snyk cos gateway get`](cos-gateway-get.md), `snyk cos gateway get --help`: show the details of a gateway
- [`snyk cos gateway update`](cos-gateway-update.md), `snyk cos gateway update --help`: update a gateway
- [`snyk cos gateway delete`](cos-gateway-delete.md), `snyk cos gateway delete --help`: delete a gateway
- [`snyk cos gateway run`](cos-gateway-run.md), `snyk cos gateway run --help`: run a gateway

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

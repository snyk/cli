# COS gateway

## Usage

`snyk cos gateway [<COMMAND>] [<OPTIONS>]`

## Description

The `snyk cos gateway` allows you to manage gateways. A gateway is an agent you run inside your network so that scans can reach private targets: private addresses and internal or single-label names such as `jira.corp` or `intranet`, resolved by the gateway in its network.

For a list of related commands, visit the [Snyk COS](cos.md) help, `snyk cos --help`.

## Commands

- [`snyk cos gateway_create`](cos-gateway-create.md), `snyk cos finding create --help`: create a new gateway
- [`snyk cos gateway_list`](cos-gateway-list.md), `snyk cos finding list --help`: list all gateways
- [`snyk cos gateway_get`](cos-gateway-list.md), `snyk cos finding get --help`: show the details of a gateway
- [`snyk cos gateway_update`](cos-gateway-update.md), `snyk cos finding update --help`: update a gateway
- [`snyk cos gateway_delete`](cos-gateway-delete.md), `snyk cos finding delete --help`: delete a gateway
- [`snyk cos gateway_run`](cos-gateway-run.md), `snyk cos finding run --help`: run a gateway

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables to connect to the Snyk API. For more information, visit [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

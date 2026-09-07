---
description: The snyk cos scan commands for scanning applications for security issues.
---

# COS scan

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Usage

`snyk cos scan [<COMMAND>] [<OPTIONS>]`

## Description

The `snyk cos scan` command scans your applications for security issues.

For a list of related commands see the [snyk cos](cos.md) help, `snyk cos --help`.

## Commands

- [`snyk cos scan start`](cos-scan-start.md), `snyk cos scan start --help`: start a new scan on a target
- [`snyk cos scan status`](cos-scan-status.md), `snyk cos scan status --help`: show the current status of a scan
- [`snyk cos scan report`](cos-scan-report.md), `snyk cos scan report --help`: return the report for a completed scan
- [`snyk cos scan list`](cos-scan-list.md), `snyk cos scan list --help`: list scans and their statuses
- [`snyk cos scan cancel`](cos-scan-cancel.md), `snyk cos scan cancel --help`: cancel a running scan

Before you can run a scan, you must create a target. For more information, see [COS target](cos-target.md)

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

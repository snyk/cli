---
description: >-
  The snyk cos commands for finding security vulnerabilities with Snyk
  Continuous Offensive Security (COS).
---

# COS

{% hint style="info" %}
**Release status**

The `snyk cos` command set is in Closed Beta and is available only for Enterprise plans. If you want to set it up in your Group or Organization, contact your Snyk account team.
{% endhint %}

## Prerequisites

- A Snyk account with the Continuous Offensive Security (COS) entitlement.
- Authenticate to use the CLI. For more information, see [Authenticate to use the CLI](https://docs.snyk.io/developer-tools/snyk-cli/authenticate-to-use-the-cli).

## Usage

`snyk cos <COMMAND> [<OPTIONS>] [<PATH>]`

## Description

The `snyk cos` command is a CLI client for Snyk AI Pentesting that finds security vulnerabilities in your deployed applications.

Use the `snyk cos` subcommands to define the applications you want to test, run scans against them, and review the findings the scans produce.

## Commands

- [`snyk cos target`](cos-target.md), `snyk cos target --help`: manage your targets
- [`snyk cos scan`](cos-scan.md), `snyk cos scan --help`: scan your applications for security issues
- [`snyk cos finding`](cos-finding.md), `snyk cos finding --help`: manage your findings

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. For more information see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

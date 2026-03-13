# AI-BOM

**Note**: AI-BOM is an experimental feature and is subject to breaking changes without notice. If you are using AI-BOM, Snyk recommends installing the Snyk CLI from the [release](../releases-and-channels-for-the-snyk-cli.md#stable) channel.

## Prerequisites

- The `snyk aibom` feature requires an internet connection.
- Snyk CLI v1.1298.3 (or later).
- Your Project must be written in Python and using a [package manager](../../../supported-languages/supported-languages-list/python/) supported by Snyk.

## Usage

`$ snyk aibom --experimental [<OPTION>]`

## Description

The `snyk aibom` command generates an AI-BOM for a local software Project that is written in Python. You can use the `snyk aibom` command to identify AI models, datasets, and map the AI supply chain, including connections to external tools and services using the Model Context Protocol (MCP).

The supported format is CycloneDX v1.6 (JSON).

In the JSON file, you can see the following AI dependencies and components:

- **Models:** You can see your usage of foundational models (such as GPT-4) and open-source models (such as Llama-4). Where possible, the information surfaced also refers to model card, license, and other information.
- **Agents:** Identified based on popular AI agent libraries.
- **Tools:** Identified based on popular patterns of tool calling.
- **MCPs:** Identified based on the official MCP SDK, in addition to other popular ways of building MCPs.

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), AI-BOM created successfully.\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.\
**3**: failure, unable to find any supported files for the scan.

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## MCP and your AI-BOM

A key feature of the `snyk aibom` command is its ability to detect and map dependencies established using the MCP.

MCP is an open standard that applications use to connect LLMs with external tools, data sources, and services. These connections create a new layer in your AI supply chain that needs to be monitored for security and compliance.

`snyk aibom` analyzes your source code to identify and categorize MCP components into a clear dependency graph:

- **MCP client**: The component in your code that initiates a connection to a server.
- **MCP server**: The component providing tools or resources. This can be a local script or a remote network service.
- **Tools and resources**: The specific functions (tool) or data (resource) made available by an MCP server.

When you run `snyk aibom`, the output shows these dependencies clearly. For example, you can see a chain showing that your root application depends on an mcp-client, which depends on an mcp-server, which in turn provides a specific tool. This gives you full visibility into the services your AI application relies on.

## Options

### `--experimental`

**Required**. Use experimental command features. This option is required because the command is in its experimental phase.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific Snyk Organization. The `<ORG_ID>` influences private test limits.

If you have multiple Organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested Projects are tested under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

### `--html`

**Optional.** Embed the AIBOM into an HTML visualization of the AIBOM components and their relationships.

### `[--json-file-output]`

**Optional.** Save the AIBOM output as a JSON data structure directly to the specified file.

#### Upcoming Features in 1.1303.0

### `--upload`&#x20;

**Optional**. Persist the AIBOM into your Snyk Organization. This flag requires the [`--repo`](aibom.md#repo) flag. It enables you to view your AI-BOM for the repository in the Evo web interface.

### `--repo`&#x20;

**Optional**. Specify the repository to use when persisting the AI-BOM. Required when you use the [`--upload`](aibom.md#upload) flag.

```bash
snyk aibom --upload --repo https://github.com/[owner]/[repo]
```

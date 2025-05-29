# AIBOM

## Prerequisites

**Feature availability:** This experimental feature is available to customers on request. If you want to use this feature, contact your Snyk representative to get access. Then download the CLI from the preview release channel.

The `snyk aibom` feature requires an internet connection.

## Usage

`$ snyk aibom --experimental [<OPTION>]`

## Description

The `snyk aibom` command generates an AIBOM for a local software project that is written in Python.

Use the `snyk aibom` command to understand what AI models, datasets, tools, and so on are used in that project.

The current supported format is CycloneDX v1.6 (JSON).

## Options

### `--experimental`

Required. Use experimental command features. This option is required because the command is in its experimental phase.

### `--html`

Optional. Embed the AIBOM into an HTML visualization of the AIBOM components and their relationships.

### `[--json-file-output]`

Optional. Save the AIBOM output as a JSON data structure directly to the specified file.

# Agent scan

**Warning:** The `snyk agent-scan` command is experimental. The `--experimental` flag is required. Behavior and options may change in future releases without notice.

## Usage

`snyk agent-scan --experimental [<PATH>] [<OPTIONS>]`

## Description

The `snyk agent-scan` command scans agent-related assets, including MCP server configuration and skills, and can upload scan results to Snyk Evo.

If you provide a path, the command scans that path. If you do not provide a subcommand, the CLI runs the default `scan` action.

The command downloads and runs the platform-specific `agent-scan` binary when needed.

## Options

### `--experimental`

Required. Acknowledges that this command is experimental.

### `--client-id=<UUID>`

Specify the client ID to use when uploading scan results.

If you do not specify `--client-id`, the CLI attempts to discover one from your authenticated Snyk account.

### `--tenant-id=<UUID>`

Specify the tenant ID to use for client ID discovery.

You can also set the tenant ID with the `SNYK_TENANT_ID` environment variable.

### `--json`

Print the output as JSON.

When using `--json`, provide `--tenant-id` if client ID discovery is required.

### `--skills[=<PATH>]`

Scan skills in addition to MCP servers.

You can use this option as a boolean flag or provide a folder path.

### `--no-upload`

Do not upload scan results to Snyk Evo.

This option requires authentication.

## Examples

Scan the current directory:

`$ snyk agent-scan --experimental`

Scan a specific directory:

`$ snyk agent-scan --experimental ./my-agent`

Scan skills and print JSON:

`$ snyk agent-scan --experimental --skills --json --tenant-id=<UUID>`

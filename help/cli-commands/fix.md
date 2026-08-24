# Fix (`snyk fix --agentic`)

{% hint style="info" %}
`snyk fix --agentic` is a new LLM-driven command. It is distinct from the legacy `snyk fix` command, which used a deterministic fix engine and is deprecated.
{% endhint %}

## Prerequisites

To use the `snyk fix --agentic` command:

- Install the latest version of the [Snyk CLI](../install-or-update-the-snyk-cli/)
- [Authenticate](auth.md) your machine with the Snyk CLI using `snyk auth`
- Configure an LLM provider API key. See [Remediation Agent](../../../agent-security/remediation-agent.md) for supported providers and setup instructions.

## Usage

`snyk fix --agentic --experimental --sca|--sast [<PATH>]`

## Description

The `snyk fix --agentic` command is an LLM-driven vulnerability remediation command. It scans your project for vulnerabilities, generates a fix plan enriched with Snyk's security intelligence, and walks you through applying and verifying each fix interactively. Use `--auto-approve` to apply fixes without prompting.

Choose what to remediate with a product flag:

- `--sca` — Snyk Open Source. Fixes vulnerable dependencies by bumping versions and adding overrides.
- `--sast` — Snyk Code. Applies Snyk Agent Fix suggestions for source-code security issues and rescans to confirm the issue is resolved.

You must pass exactly one of `--sca` or `--sast`. The `--experimental` flag is required alongside `--agentic`.

For conceptual documentation about the Remediation Agent, including setup instructions and supported IDEs, see [Remediation Agent](../../../agent-security/remediation-agent.md).

## Exit codes

**0**: Success. Vulnerabilities were remediated.\
**1**: Action needed. Some vulnerabilities could not be fixed.\
**2**: Failure. An error occurred. Use `-d` to output the debug logs.

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--agentic`

Enable the LLM-driven fix flow. Required to use this command in agentic mode.

### `--experimental`

Required alongside `--agentic`. Acknowledges early-access status.

### `--sca`

Remediate Snyk Open Source (dependency) vulnerabilities. Mutually exclusive with `--sast`.

### `--sast`

Remediate Snyk Code (source-code) issues. Mutually exclusive with `--sca`.

### `--provider=<PROVIDER>`

LLM provider to use. Accepted values: `anthropic` (default), `openai`, `vertex`, `litellm`, `ollama`.

Example: `snyk fix --agentic --experimental --sca --provider=openai`

### `--model=<MODEL>`

Model ID. Required for Ollama (for example, `llama3.1`). Optional override for Anthropic and OpenAI.

Example: `snyk fix --agentic --experimental --sca --provider=ollama --model=llama3.1`

### `--dry-run`

Show the fix plan without applying changes.

Example: `snyk fix --agentic --experimental --sca --dry-run`

### `--auto-approve`

Automatically approve fixes for all discovered issues. Combine with `--issue-ids` or `--severity-threshold` to restrict scope.

### `--issue-ids=<ID>[,<ID>]...`

Comma-separated list of Snyk issue IDs to fix.

Example: `snyk fix --agentic --experimental --sca --issue-ids=SNYK-JS-FOO-123,SNYK-JS-BAR-456`

### `--severity-threshold=<SEVERITY>`

Fix issues at or above this severity. Accepted values: `CRITICAL`, `HIGH`, `MEDIUM`.

Example: `snyk fix --agentic --experimental --sca --severity-threshold=HIGH`

### `--no-breakability`

Skip the Snyk breakability assessment and use local heuristics only.

### `-d`, `--debug`

Print debug information to stderr.

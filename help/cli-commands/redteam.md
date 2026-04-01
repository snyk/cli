# Redteam

**Warning:** `snyk redteam` is an experimental command. The `--experimental` flag is required. Behavior and options may change in future releases without notice.

Agent Red Teaming is potentially disruptive. Before running this command, ensure you:

- Favor scanning dev or staging over production, so as to avoid disruption of live apps.
- Use test data and accounts rather than real customer or user data.
- Configure scan authentication with test credentials.
- Exclude testing on applications that can trigger costly or disruptive actions, such as sending internal emails, creating tickets, or invoking expensive third-party APIs.

## Prerequisites

- Snyk CLI v1.1303.1 (or later).
- Authenticated Snyk CLI (run `snyk auth`).

## Usage

`snyk redteam --experimental [<OPTION>]`

## Description

The `snyk redteam` command runs adversarial security tests against AI-powered applications. It sends a series of attack prompts to your target, evaluates the responses, and reports any discovered vulnerabilities.

The command works by:

1. Reading a YAML configuration file (or CLI flags) that describes the target endpoint
2. Creating a scan with the specified goals and strategies
3. Iterating through attack prompts -- sending each to your target and feeding the responses back for scoring
4. Outputting the results as JSON (default) or an interactive HTML report

For more details, see [Snyk Agent Red teaming](https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-agent-red-teaming)

## Commands

### `snyk redteam`

Run a red team scan. This is the primary command.

### `snyk redteam setup`

Launch an interactive web-based setup wizard that guides you through target configuration and produces a `redteam.yaml` file.

### `snyk redteam ping`

Send a test request to the configured target endpoint to verify connectivity and response parsing before running a full scan.

### `snyk redteam get`

Retrieve results from a previously completed scan by its scan ID.

## Options

### Options for `snyk redteam`

#### `--experimental`

**Required.** Acknowledges that this is an experimental feature.

#### `--config=<FILE_PATH>`

Path to the YAML configuration file. Default: `redteam.yaml` in the current directory.

If no config file is found, `--target-url` must be provided to run.

#### `--target-url=<URL>`

URL of the target endpoint to scan. Overrides `target.settings.url` from the configuration file. Must be a valid HTTP or HTTPS URL.

When used without a config file, this is sufficient to run a basic scan with default settings.

#### `--request-body-template=<TEMPLATE>`

JSON template for the HTTP request body sent to the target. Must contain the `{{prompt}}` placeholder, which is replaced with each attack prompt. Overrides `target.settings.request_body_template` from the config file.

Default: `{"message": "{{prompt}}"}`

#### `--response-selector=<JMESPATH_EXPRESSION>`

JMESPath expression used to extract the AI response from the target's JSON response body. Overrides `target.settings.response_selector` from the config file.

Default: `response`&#x20;

For more information about the JMESPath expression syntax, visit [jmespath.org](https://jmespath.org/)

#### `--header=<"KEY: VALUE">`

HTTP headers to include in requests to the target. Specified as `"Key: Value"` strings. This flag is repeatable; headers are appended to any headers defined in the config file.

Example: `--header="Authorization: Bearer sk-abc123" --header="X-Custom: value"`

#### `--purpose=<TEXT>`

A description of the target application's intended purpose. Provides context for the attack engine and improves scoring accuracy. Overrides `target.context.purpose` from the config file.

#### `--system-prompt=<TEXT>`

The known system prompt of the target application. Used as ground truth for prompt-extraction scoring -- if the system prompt is known, the judge can compare leaked content against it for more accurate verdicts. Overrides `target.context.ground_truth.system_prompt` from the config file.

#### `--tool=<TOOL_NAME>`

Tool names that the target application has access to. Used as ground truth for tool-extraction scoring. This flag is repeatable. Overrides `target.context.ground_truth.tools` from the config file.

Example: `--tool="search_orders" --tool="get_faq" --tools="lookup_customer"`

#### `--json`

Print the output as a JSON to stdout.

#### `--json-file-output=<PATH>`

Save the output as a JSON to the specified file path.

#### `--html`

Output the scan report in HTML format instead of JSON. The HTML is written to stdout.

#### `--html-file-output=<FILE_PATH>`

Write the HTML report to the specified file path. Implies HTML output.

#### `--list-goals`

List all available attack goals with descriptions and exit. Does not run a scan.

#### `--list-strategies`

List all available attack strategies with descriptions and exit. Does not run a scan.

#### `--tenant-id=<UUID>`

Snyk tenant ID. Auto-discovered from your authenticated Snyk account if not provided. Only needed when your account belongs to multiple tenants.

### Options for `snyk redteam setup`&#x20;

#### `--experimental`

**Required.**

#### `--config=<FILE_PATH>`

Path to an existing configuration file to load into the wizard for editing.

Default: `redteam.yaml` in the current directory (loaded automatically if present).

#### `--port=<NUMBER>`

Port for the setup wizard's local web server.

Default: `8484`.

### Options for `snyk redteam ping`

Accepts the following target-related flags same as `snyk redteam`:

`--experimental` (required), `--config`, `--target-url`, `--request-body-template`, `--response-selector`, `--headers`

### Options for `snyk redteam get`

#### `--id=<SCAN_ID>`

**Required.** The UUID of the scan to retrieve results for.

Accepts the following flags same as `snyk redteam`:

`--experimental` (required), `--html`, `--html-file-output=<FILE_PATH>`, `--tenant-id=<UUID>`

## Configuration file

The `redteam.yaml` file defines the scan target and testing parameters. The CLI looks for this file in the current directory by default, or you can specify a path with `--config`.

### Complete reference

```yaml
target:
  # Required. A human-readable name for the target application.
  name: 'My AI Application'

  # Optional. Target type: "http" (default).
  type: http

  context:
    # Recommended. Describes the intended purpose of the target application.
    # Improves attack relevance and scoring accuracy.
    purpose: 'Customer support chatbot that helps users with orders and returns'

    # Optional. Known ground truth about the target, used for scoring.
    ground_truth:
      # The actual system prompt of the target. Enables accurate
      # prompt-extraction scoring by comparing leaked content against it.
      system_prompt: 'You are a helpful customer service assistant...'

      # Tool names the target has access to. Enables tool-extraction scoring.
      tools:
        - 'search_orders'
        - 'get_faq'
        - 'lookup_customer'

  settings:
    # Required. Full HTTP(S) URL of the target endpoint.
    url: 'https://api.example.com/chat'

    # Optional. HTTP headers sent with every request to the target.
    # Typically used for authentication.
    headers:
      - name: 'Authorization'
        value: 'Bearer sk-proj-abc123...'
      - name: 'Content-Type'
        value: 'application/json'

    # Optional. JSON template for the request body. Must contain the
    # {{prompt}} placeholder, which is replaced with each attack prompt.
    # The prompt text is JSON-escaped before substitution.
    # Default: '{"message": "{{prompt}}"}'
    request_body_template: '{"message": "{{prompt}}"}'

    # Optional. JMESPath expression to extract the AI response from the
    # target's JSON response body.
    # Default: "response"
    response_selector: 'response'

# Optional. List of attack goals. Each goal defines what the attack tries
# to achieve. Default: ["system_prompt_extraction"]
# Run `snyk redteam --experimental --list-goals` for the full list.
goals:
  - 'system_prompt_extraction'
  - 'purpose_hijacking'

# Optional. List of attack strategies. Each strategy defines how the attack
# approaches its goal. Default: ["directly_asking"]
# Run `snyk redteam --experimental --list-strategies` for the full list.
strategies:
  - 'directly_asking'
  - 'crescendo'
```

### Validation rules

The CLI validates the configuration before starting a scan:

- `target.settings.url` must be a valid HTTP or HTTPS URL
- `target.settings.request_body_template` must contain the `{{prompt}}` placeholder and be valid JSON (after placeholder substitution)
- `target.settings.response_selector` must be a valid JMESPath expression

### CLI flag overrides

CLI flags take precedence over config file values. This allows you to maintain a base config file and override specific fields per run:

```bash
# Override the URL from the config file
snyk redteam --experimental --config=redteam.yaml --target-url=https://staging.example.com/chat

# Add extra headers on top of those in the config
snyk redteam --experimental --headers="X-Debug: true"
```

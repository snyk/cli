# AI Red Teaming

**Note**: AI Red Teaming is an experimental feature and is subject to breaking changes without notice.

AI Red Teaming is potentially disruptive. Before running this CLI, make sure you:

- Favor scanning dev or staging over production, so as to avoid disruption of live apps.
- Use test data and accounts rather than real customer or user data.
- Configure scan authentication with test credentials.
- Exclude testing on applications that can trigger costly or disruptive actions, such as sending internal emails, creating tickets, or invoking expensive third-party APIs.

## Prerequisites

- Requires an [internet connection](https://docs.snyk.io/snyk-data-and-governance/regional-hosting-and-data-residency#available-snyk-regions).
- Requires Snyk CLI v1.1300.1 (or later).

## Usage

1. Create your YAML [configuration file](https://docs.snyk.io/developer-tools/snyk-cli/commands/ai-red-teaming#configuration-file).
2. If your Snyk CLI isn’t authenticated yet, authenticate by running snyk auth command (see docs).
3. Run the following command: `$ snyk redteam --experimental [<OPTION>]`

## Description

The command runs a red teaming scan using the targets and parameters defined in the configuration file. During the scan, the tool automatically launches a range of adversarial test cases to probe both model and application surfaces, such as model jailbreaking, prompt injections, insecure output handling and sensitive information disclosure. Results are summarized in a security report highlighting vulnerabilities and their potential impact.

## Options

### `--experimental`

Required. Use experimental command features. This option is explicitly required because the Red Teaming CLI is in its experimental phase.

### `--org=<ORG_ID>`

Optional. Specify the \<ORG_ID> to run Snyk commands tied to a specific Snyk Organization.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

### `--config=<PATH>`

Optional. Path to a custom configuration file.

Default: redteam.yaml in the current working directory.

### `--json-file-output=<PATH>`

Optional. Save the output as a JSON to the specified file path.

## Configuration File

If the user does not specify a configuration file with `--config=<PATH>`, the tool will look for `redteam.yaml` in the current working directory by default.

Example configuration file:

```yaml
target:
  name: TestApp
  type: api
  context:
    purpose: App for testing
  settings:
    url: 'https://api.example.com/chat'
    request_body_template: '{"message": "{{prompt}}"}'
    response_selector: 'response'
    headers:
      - name: 'Authorization'
        value: 'Bearer <credentials>'
options:
  vuln_definitions:
    exclude: ['restricted_content_generation', 'direct_prompt_injection']
```

### Field Reference

#### target (object)

Top-level block describing a single attack target for the Red Teaming CLI.

**name (string, required)**

Human-friendly label for this target.

**context (object, required)**

Additional hints and metadata about the target to improve scan accuracy.

**type (string, required)**

The type of target. Currently supported values: api.

**settings (object, required)**

Target-specific settings. The exact allowed keys depend on type.

#### context (object)

**purpose (string, required)**

Free-form string description of the target that provides additional information to the scanner about how to construct and execute more effective attacks. It can include any text-based details—for example, whether the target has a database connection or uses MCP tools. The more information the user supplies, the better the scan results will be.

#### settings (for type: api)

**url (string, required)**

The full endpoint URL the CLI will scan.

**headers (array of objects, optional)**

HTTP headers to include in each request. Each header object must include:

- name (string, required) — header name (e.g., Authorization, Content-Type)
- value (string, required) — header value

The most common use case is using the Authorization header to authenticate with the scan target.

```yaml
headers:
  - name: 'Authorization'
    value: 'Bearer <credentials>'
```

**request_body_template (string, required)**

A request-body template (must be valid JSON) sent with each request. Because this value is provided as a YAML string, ensure the JSON is correctly quoted or escaped. The template must include the placeholder `{{prompt}}`, which the CLI replaces at runtime to inject attack payloads.

```yaml
request_body_template: |
  {
    "user": "Mark",
    "type": "text",
    "message": "{{prompt}}"
  }
```

**response_selector (string, required)**

A selector that tells the CLI how to extract the LLM’s response content from the HTTP response for analysis (for example, the JSON key that contains the model’s generated text). The selector uses JMESPath (see[ https://jmespath.org/tutorial.html](https://jmespath.org/tutorial.html)) to locate the response value inside the JSON.

Example

- When the response body is: `{ "response": "..." }` use `target.settings.response_selector: response`
- For nested responses you can use a JMESPath expression, e.g.: `target.settings.response_selector: data.items[0].text`

#### options (object)

Top-level block that defines scan-wide configuration settings.

**vuln_definitions. exclude (array of strings, optional)**

Defines which vulnerabilities should be excluded from testing.

- Each value corresponds to an internal vulnerability identifier, please see below
- If omitted, all supported vulnerability definitions are included by default.

Example:

```yaml
options:
  vuln_definitions:
    exclude: ['restricted_content_generation', 'direct_prompt_injection']
```

## Supported Vulnerabilities

Current supported vulnerabilities ids:

- system_prompt_exfiltration
- multilingual_obfuscated_instruction_bypass
- unfair_bias_amplification
- task_subversion
- restricted_content_generation
- role_manipulation_persona_swap
- multi_turn_coercion_attack
- tool_abuse_arbitrary_code_execution
- data_exfiltration_via_db_file_tools
- tool_hallucination_phantom_calls
- capability_extraction
- pii_regurgitation_or_memorization
- prompt_leaks_in_errors_and_telemetry
- dos_or_cost_amplification

## Limitations

Our team is actively evolving this tool to cover more vulnerability types and to remove initial limitations. Note the current limitations:

- Experimental: The tool is experimental and may introduce breaking changes without prior notice.
- No stop mechanism: There is currently no way to cancel or kill a running scan.
- Authentication: Only header-based authentication is supported. Other authentication methods are not supported at this time.
- Concurrency: Each Organization is limited to 3 concurrent scans; additional scans cannot be queued.

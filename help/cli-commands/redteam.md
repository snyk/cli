# Redteam

**Note**: Redteam is an experimental feature and is subject to breaking changes without notice. The feature is also referenced as AI Red Teaming.

Redteam is potentially disruptive. Before running this command, ensure you:

- Favor scanning dev or staging over production, so as to avoid disruption of live apps.
- Use test data and accounts rather than real customer or user data.
- Configure scan authentication with test credentials.
- Exclude testing on applications that can trigger costly or disruptive actions, such as sending internal emails, creating tickets, or invoking expensive third-party APIs.

## Prerequisites

- An [internet connection](../../snyk-ci-cd-integrations/azure-pipelines-integration/regional-api-endpoints.md).
- Snyk CLI v1.1300.1 (or later).
- YAML [configuration file](redteam.md#configuration-file).
- The Snyk CLI must be authenticated. Run `snyk auth` if it is not authenticated. For guidance on the `snyk auth` command, visit the [Auth](auth.md) page.
- A role with the Edit Organization permission, granted by an Organization or Group Administrator, or using a custom role.

## Usage

Run the command: `snyk redteam --experimental [<OPTION>]`

## Description

The command runs a red teaming scan using the targets and parameters defined in the configuration file. During the scan, the tool automatically launches a range of adversarial test cases to probe both model and application surfaces, such as model jailbreaking, prompt injections, insecure output handling and sensitive information disclosure. Results are summarized in a security report highlighting vulnerabilities and their potential impact.

## Options

### `--experimental`

Required. Use experimental command features. This option is explicitly required because the `redteam` command is in its experimental phase.

### `--org=<ORG_ID>`

Optional. Specify the `<ORG_ID>` to run Snyk commands tied to a specific Snyk Organization.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

### `--config=<PATH>`

Optional. Path to a custom configuration file.

Default: redteam.yaml in the current working directory.

### `--json-file-output=<PATH>`

Optional. Save the output as a JSON to the specified file path.

## Configuration file

If you do not specify a configuration file with `--config=<PATH>`, the tool searches for `redteam.yaml` in the current working directory by default.

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

## Field reference

#### target (object)

Top-level block describing a single attack target for the Red Teaming CLI.

**name (string, required)**

Human-friendly label for this target.

**context (object, required)**

Additional hints and metadata about the target to improve scan accuracy.

**type (string, required)**

The type of target. Supported values: api.

**settings (object, required)**

Target-specific settings. The exact allowed keys depend on type.

#### context (object)

**purpose (string, required)**

Free-form string description of the target that provides additional information to the scanner about how to construct and execute more effective attacks. It can include any text-based detaills, for example, whether the target has a database connection or uses MCP tools. The more information you supply, the better the scan results.

#### settings (for type: api)

**url (string, required)**

The full endpoint URL the CLI scans.

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

A request-body template (must be valid JSON) sent with each request. As this value is provided as a YAML string, ensure the JSON is correctly quoted or escaped. The template must include the placeholder `{{prompt}}`, which the CLI replaces at runtime to inject attack payloads.

```yaml
request_body_template: |
  {
    "user": "Mark",
    "type": "text",
    "message": "{{prompt}}"
  }
```

**response_selector (string, required)**

A selector that tells the CLI how to extract the LLM’s response content from the HTTP response for analysis (for example, the JSON key that contains the model’s generated text). The selector uses JMESPath (visit[ https://jmespath.org/tutorial.html](https://jmespath.org/tutorial.html)) to locate the response value inside the JSON.

Example

- If the response body is: `{ "response": "..." }` use `target.settings.response_selector: response`
- For nested responses you can use a JMESPath expression, for example, `target.settings.response_selector: data.items[0].text`

#### options (object)

Top-level block that defines scan-wide configuration settings.

**vuln_definitions. exclude (array of strings, optional)**

Defines which vulnerabilities should be excluded from testing.

- Each value corresponds to an internal vulnerability identifier.
- If omitted, all supported vulnerability definitions are included by default.

Example:

```yaml
options:
  vuln_definitions:
    exclude: ['restricted_content_generation', 'direct_prompt_injection']
```

**scanning_agent (string, optional)**

Defines a `uuid` of your on-premise scanning agent to be used to proxy requests from Snyk to your target application.

Example:

```yaml
options:
  scanning_agent: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

## On-Prem support

Snyk also supports scanning targets that are not publicly accessible. Snyk utilizes an on-prem agent `Farcaster`. To learn more about how this works and the different configuration options, visit the [GitHub repository](https://github.com/Probely/farcaster-onprem-agent).

Note that the scanning agent is scoped to the user and Organization, meaning that only the user who set up the agent can use it.

### Quick start

1.  Create a scanning agent:<br>

    ```bash
    snyk redteam scanning-agent create --experimental
    ```

2.  Copy the output and spin the scanning agent container with `docker run ...`&#x20;
3.  Update your [configuration](redteam.md#configuration-file) to point to a target your internal scanning agent container can reach, for example, `host.docker.internal` (if testing locally).
4.  Add the `scanning_agent` option to the [options](redteam.md#options-object) field in the [configuration](redteam.md#configuration-file)
5.  Run the scan:<br>

    ```bash
    snyk redteam --experimental
    ```

### Creating a scanning agent

To create scanning agent, run:

```bash
snyk redteam scanning-agent create --experimental
```

Expect the following output:

```bash
Agent Token:
<your-super-secret-token>

The token will only be displayed once. Please copy it and save it securely.

Installation

Docker:

To install the agent, execute the following command on your terminal:

docker run -d --name probely-agent --cap-add NET_ADMIN -e FARCASTER_AGENT_TOKEN=<your-super-secret-token> \
-e FARCASTER_API_URL=https://api.us.probely.com --device /dev/net/tun probely/farcaster-onprem-agent:v3

Then, you can check the agent logs by running the following command:

docker logs -f probely-agent

Check the agent documentation for more details:
https://github.com/Probely/farcaster-onprem-agent

{"name":"test-output","installer_generated":false,"id":"<uuid>","online":false,"fallback":false,"rx_bytes":0,"tx_bytes":0,"latest_handshake":0}
```

Notes:

- Ensure to copy the `Agent Token`, store it securely, and follow the instructions.&#x20;
- You are limited to three scanning agents per user and Organization.&#x20;

#### Specifying the name (optional)

Specify the name of your scanning agent:

```bash
snyk redteam scanning-agent create --name your-scanning-agent --experimental
```

### Listing scanning agents

```bash
snyk redteam scanning-agent --experimental
```

This returns a list of agents:

{% code overflow="wrap" %}

```json
[
  {
    "name": "test",
    "installer_generated": true,
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "online": true,
    "fallback": false,
    "rx_bytes": 252168,
    "tx_bytes": 240680,
    "latest_handshake": 1765443375
  }
]
```

{% endcode %}

### Deleting a scanning agent

```bash
snyk redteam scanning-agent delete --id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx --experimental
```

### Running a scan with an agent

To run a scan with an agent you have two options: specifying `scanning_agent` in the configuration [options](redteam.md#options-object) or passing `--scanning-agent-id` flag to the `redteam` command.&#x20;

#### Running using the CLI

```bash
snyk redteam --scanning-agent-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx --experimental
```

Note: This method takes precedence over other specific methods.

#### Running using a configuration file

1.  Specify the `scanning_agent` option in the `options` section of your configuration file:<br>

    ```yaml
    options:
      scanning_agent: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    ```

2.  Run the scan:<br>

    ```bash
    snyk redteam --experimental
    ```

## Supported vulnerabilities

The following vulnerabilities ids are supported:

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

Snyk is actively evolving this tool to cover more vulnerability types and to remove initial limitations. Note these limitations:

- Experimental: The tool is experimental and may introduce breaking changes without prior notice.
- No stop mechanism: Running scans cannot be cancelled or killed.
- Authentication: Only header-based authentication is supported. Other authentication methods are not supported.
- Concurrency: Each Organization is limited to three concurrent scans. Additional scans cannot be queued.

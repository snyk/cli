# snyk apps -- Create and manage your Snyk Apps

# Usage

`snyk apps <COMMAND> [<OPTIONS>]`

## Description

Snyk Apps are integrations that extend the functionality of the Snyk platform. They provide you with an opportunity to mould your Snyk experience to suit your specific needs.

[For more information see our user docs](https://docs.snyk.io/features/integrations/snyk-apps)

## Commands

**_Note: All `apps` commands are only accessible behind the `--experimental` flag and the behaviour can change at any time, without prior notice. You are kindly advised to use all the commands with caution_**

### `create`

Create a new Snyk App.

## Options

### `--interactive`

Use the command in interactive mode.

### `--org=<ORG_ID>`

(Required for the `create` command)
Specify the `<ORG_ID>` to create the Snyk App under.

### `--name=<SNYK_APP_NAME>`

(Required for the `create` command)
The name of Snyk App that will be displayed to the user during the authentication flow.

### `--redirect-uris=<REDIRECT_URIS>`

(Required for the `create` command)
A comma separated list of redirect URIs. This will form a list of allowed redirect URIs to call back after authentication.

### `--scopes=<SCOPES>`

(Required for the `create` command)
A comma separated list of scopes required by your Snyk App. This will for a list of scopes that your app is allowed to request during authorization.

## Examples

### `Create Snyk App`

\$ snyk apps create --experimental --org=48ebb069-472f-40f4-b5bf-d2d103bc02d4 --name='My Awesome App' --redirect-uris=https://example1.com,https://example2.com --scopes=apps:beta

### `Create Snyk App Interactive Mode`

\$ snyk apps create --experimental --interactive

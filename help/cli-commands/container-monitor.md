# Container monitor

## Usage

`snyk container monitor [<OPTIONS>] [<IMAGE>]`

## Description

The `snyk container monitor` command captures the container image layers and dependencies in a project and monitors that snapshot for vulnerabilities, sending the results to [snyk.io](https://snyk.io)

Use the `container monitor` command before integrating your code into production, to take a snapshot of the code to be monitored in order to avoid pushing vulnerabilities into production. Choose a test frequency in your Settings if you want to change the frequency from the default, which is daily.

If you make changes to your code, you must run the `container monitor` command again.

For more information, see [Snyk CLI for container security](https://docs.snyk.io/products/snyk-container/snyk-cli-for-container-security)

## Exit codes

Possible exit codes and their meaning:

**0**: success, image layers and dependencies captured\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API.

There are environment variables that apply to the container command; see [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific Snyk Organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested and monitored projects are tested and monitored under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The Organization slug name works in the CLI, but not in the API.

`orgslugname` must match the slug name as displayed in the URL of your org in the Snyk UI: `https://app.snyk.io/org/[orgslugname]`. The orgname does not work.

For more information see the article [How to select the Organization to use in the CLI](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/how-to-select-the-organization-to-use-in-the-cli)

### `--file=<FILE_PATH>`

For more detailed advice, include the path to the Dockerfile for the image.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results on the console as a JSON data structure.

Example: `$ snyk container test --json`

**Note**: If you use an option that sets project attributes and your role lacks permission to edit project attributes the `monitor` command fails. For instructions on how to proceed see [Permissions (role) required to edit Project attributes from the Snyk CLI](https://docs.snyk.io/snyk-admin/manage-permissions-and-roles/manage-member-roles#permissions-role-required-to-edit-project-attributes-from-the-snyk-cli)

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference that differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference.

For more information see [Group projects by branch or version for monitoring](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/group-projects-by-branch-or-version-for-monitoring)

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment to one or more values (comma-separated). To clear the project environment set `--project-environment=`

Allowed values: `frontend`, `backend`, `internal`, `external`, `mobile`, `saas`, `onprem`, `hosted`, `distributed`

For more information see [Project attributes](https://docs.snyk.io/snyk-admin/snyk-projects/project-attributes)

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE]...>`

Set the project lifecycle to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`

Allowed values: `production, development, sandbox`

For more information see [Project attributes](https://docs.snyk.io/snyk-admin/snyk-projects/project-attributes)

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`

Allowed values: `critical`, `high`, `medium`, `low`

For more information see [Project attributes](https://docs.snyk.io/snyk-admin/snyk-projects/project-attributes)

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator).

Example: `--project-tags=department=finance,team=alpha`

To clear the project tags set `--project-tags=`

For more information including allowable characters see [Project tags](https://docs.snyk.io/snyk-admin/snyk-projects/project-tags)

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project-tags`

### `--app-vulns`

Allow detection of vulnerabilities in your application dependencies from container images, as well as from the operating system, all in one single scan.

In CLI versions 1.1090.0 (2023-01-24) and higher, Snyk scans for application dependencies in your image by default; you do not need to specify the `--app-vulns` option.

In CLI versions 1.962.0 through v1.1089.0, use the `--app-vulns` option with the `--json` option to see the operating system as well as application vulnerabilities in JSON format in the results.

For more information see [Detecting application vulnerabilities in container images](https://docs.snyk.io/scan-using-snyk/snyk-container/use-snyk-container-from-the-web-ui/detect-application-vulnerabilities-in-container-images)

### `--exclude-app-vulns`

Allow disabling scans for app vulnerabilities; in CLI versions 1.1090.0 (2023-01-24) and higher, `app-vulns` is enabled by default.

In earlier releases, cannot be used with `--app-vulns`.

For more information see [Detecting application vulnerabilities in container images](https://docs.snyk.io/scan-using-snyk/snyk-container/use-snyk-container-from-the-web-ui/detect-application-vulnerabilities-in-container-images)

### `--exclude-node-modules`

Allow disabling the scan of `node_modules` directories inside node.js container images.

In CLI versions v1.1292.0 and higher, `node_modules` scanning is enabled by default.

&#x20;When `node_modules` scanning is disabled, Snyk reports vulnerabilities for npm Projects sourced from application file pairs: `[package.json, package-lock.json], [package.json, yarn.lock]`.

### `--nested-jars-depth`

When `app-vulns` is enabled, use the `--nested-jars-depth=n` option to set how many levels of nested jars Snyk is to unpack. Depth must be a number.

### `--exclude-base-image-vulns`

Do not show vulnerabilities introduced only by the base image. Works for operating system packages only. Available when using `snyk container test` only. Provided for compatibility with `snyk container test`. Using this option with `snyk container monitor` will not have any effect

### `--platform=<PLATFORM>`

For multi-architecture images, specify the platform to test.

Supported platforms are: `linux/amd64`, `linux/arm64`, `linux/riscv64`, `linux/ppc64le`, `linux/s390x`, `linux/386`, `linux/arm/v7`, or `linux/arm/v6`

### `--username=<CONTAINER_REGISTRY_USERNAME>`

Specify a username to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

### `--password=<CONTAINER_REGISTRY_PASSWORD>`

Specify a password to use when connecting to a container registry. This is ignored in favor of local Docker binary credentials when Docker is present.

## Example for the container monitor command

**Scan and monitor Docker images**

`$ snyk container monitor <image>`

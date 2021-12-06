# snyk monitor -- Snapshot and continuously monitor your project

## Usage

`snyk monitor [<OPTIONS>]`

## Description

Create a project on the Snyk website that will be continuously monitored for new vulnerabilities. After running this command you will see it by logging in to the website and viewing Your projects.

## Options

To see command-specific flags and usage, see `help` command, e.g. `snyk container --help`.
For advanced usage, we offer language and context specific flags, listed further down this document.

### `--all-projects`

Auto-detect all projects in working directory

### `--detection-depth=<DEPTH>`

Use with --all-projects or --yarn-workspaces to indicate how many sub-directories to search. `DEPTH` must be a number.

Default: 4 (the current working directory and 3 sub-directories)

### `--exclude=<DIRECTORY>[,<DIRECTORY>]...>`

Can be used with --all-projects and --yarn-workspaces to indicate sub-directories and files to exclude. Must be comma separated.

If using with `--detection-depth` exclude ignores directories at any level deep.

### `--prune-repeated-subdependencies`, `-p`

Prune dependency trees, removing duplicate sub-dependencies.
Will still find all vulnerabilities, but potentially not all of the vulnerable paths.

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository that you would like to monitor.

### `--dev`

Include development-only dependencies. Applicable only for some package managers. E.g. _devDependencies_ in npm or _:development_ dependencies in Gemfile.

Default: scan only production dependencies

### `--org=<ORG_NAME>`

Specify the <ORG_NAME> to run Snyk commands tied to a specific organization. This will influence where will new projects be created after running `monitor` command, some features availability and private tests limits.
If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_NAME>`

Setting a default will ensure all newly monitored projects will be created
under your default organization. If you need to override the default, you can use the `--org=<ORG_NAME>`argument.

Default: uses `<ORG_NAME>` that sets as default in your [Account settings](https://app.snyk.io/account)

### `--file=<FILE>`

Sets a package file.

When testing locally or monitoring a project, you can specify the file that Snyk should inspect for package information. When ommitted Snyk will try to detect the appropriate file for your project.

### `--ignore-policy`

Ignores all set policies. The current policy in `.snyk` file, Org level ignores and the project policy on snyk.io.

### `--trust-policies`

Applies and uses ignore rules from your dependencies' Snyk policies, otherwise ignore policies are only shown as a suggestion.

### `--show-vulnerable-paths`=none|some|all

Display the dependency paths from the top level dependencies, down to the vulnerable packages. Doesn't affect output when using JSON `--json` output.

Default: <some> (a few example paths shown)
<false> is an alias for <none>.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--target-reference=<TARGET_REFERENCE>`

A reference which differentiates this project. For example, a branch name or version. Projects using the same reference can be used for grouping. Only supported for Snyk Open Source. [More information](https://snyk.info/3B0vTPs).

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment to one or more values (comma-separated). To clear the project environment set `--project-environment=`. Allowed values: frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...>`

Set the project lifecycle to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`. Allowed values: production, development, sandbox

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`. Allowed values: critical, high, medium, low

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator). e.g. --project-tags=department=finance,team=alpha. To clear the project tags set `--project-tags=`

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project-tags`.

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a snyk policy file.

### `--json`

Prints results in JSON format.

### `--sarif`

Return results in SARIF format.

### `--severity-threshold=low|medium|high|critical`

Only report vulnerabilities of provided level or higher.

### `--fail-on=all|upgradable|patchable`

Only fail when there are vulnerabilities that can be fixed.

- `all`: fails when there is at least one vulnerability that can be either upgraded or patched.
- `upgradable`: fails when there is at least one vulnerability that can be upgraded.
- `patchable`: fails when there is at least one vulnerability that can be patched.

If vulnerabilities do not have a fix and this option is being used, tests will pass.

### `-- [<COMPILER_OPTIONS>]`

Pass extra arguments directly to Gradle or Maven.
E.g. `snyk test -- --build-cache`

Below are flags that are influencing CLI behavior for specific projects, languages and contexts:

### Maven options

#### `--scan-all-unmanaged`

Auto detects maven jars, aars, and wars in given directory. Individual testing can be done with `--file=<JAR_FILE_NAME>`

#### `--reachable`

Analyze your source code to find which vulnerable
functions and packages are called.

#### `--reachable-timeout=<TIMEOUT>`

The amount of time (in seconds) to wait for Snyk to gather reachability data. If it takes longer than <TIMEOUT>, Reachable Vulnerabilities are not reported. This does not affect regular test or monitor output.

Default: 300 (5 minutes).

### Gradle options

[More information about Gradle CLI options](https://snyk.co/ucT6P)

#### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, test a specific sub-project.

#### `--all-sub-projects`

For "multi project" configurations, test all sub-projects.

#### `--configuration-matching=<CONFIGURATION_REGEX>`

Resolve dependencies using only configuration(s) that match the provided Java regular expression, e.g. `^releaseRuntimeClasspath$`.

#### `--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...`

Select certain values of configuration attributes to resolve the dependencies. E.g. `buildtype:release,usage:java-runtime`

#### `--reachable`

Analyze your source code to find which vulnerable
functions and packages are called.

#### `--reachable-timeout=<TIMEOUT>`

The amount of time (in seconds) to wait for Snyk to gather reachability data. If it takes longer than <TIMEOUT>, Reachable Vulnerabilities are not reported. This does not affect regular test or monitor output.

Default: 300 (5 minutes).

#### `--init-script=<FILE`

For projects that contain a gradle initialization script.

### .Net & NuGet options

#### `--assets-project-name`

When monitoring a .NET project using NuGet `PackageReference` use the project name in project.assets.json, if found.

#### `--packages-folder`

Custom path to packages folder

#### `--project-name-prefix=<PREFIX_STRING>`

When monitoring a .NET project, use this flag to add a custom prefix to the name of files inside a project along with any desired separators, e.g. `snyk monitor --file=my-project.sln --project-name-prefix=my-group/`. This is useful when you have multiple projects with the same name in other sln files.

### npm options

#### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: true

### Yarn options

#### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: true

#### `--yarn-workspaces`

Detect and scan yarn workspaces. You can specify how many sub-directories to search using `--detection-depth` and exclude directories and files using `--exclude`.

### CocoaPods options

#### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: false

### Python options

#### `--command=<COMMAND>`

Indicate which specific Python commands to use based on Python version. The default is `python` which executes your systems default python version. Run 'python -V' to find out what version is it. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python`
Example: `--command=python3`

#### `--skip-unresolved`=true|false

Allow skipping packages that are not found in the environment.

### Flags available accross all commands

#### `--insecure`

Ignore unknown certificate authorities.

#### `-d`

Output debug logs.

#### `--quiet`, `-q`

Silence all output.

#### `--version`, `-v`

Prints versions.

#### `--help [<COMMAND>]`, `[<COMMAND>] --help`, `-h`

Prints a help text. You may specify a `<COMMAND>` to get more details.

## Environment

You can set these environment variables to change CLI settings.

### `SNYK_TOKEN`

Snyk authorization token. Setting this envvar will override the token that may be available in your `snyk config` settings.

[How to get your account token](https://snyk.co/ucT6J)<br />
[How to use Service Accounts](https://snyk.co/ucT6L)<br />

### `SNYK_CFG_KEY`

Allows you to override any key that's also available as `snyk config` option.

E.g. `SNYK_CFG_ORG=myorg` will override default org option in `config` with "myorg".

### `SNYK_REGISTRY_USERNAME`

Specify a username to use when connecting to a container registry. Note that using the `--username` flag will override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

### `SNYK_REGISTRY_PASSWORD`

Specify a password to use when connecting to a container registry. Note that using the `--password` flag will override this value. This will be ignored in favour of local Docker binary credentials when Docker is present.

### Connecting to Snyk API

By default Snyk CLI will connect to `https://snyk.io/api/v1`.

#### `SNYK_API`

Sets API host to use for Snyk requests. Useful for on-premise instances and configuring proxies. If set with `http` protocol CLI will upgrade the requests to `https`. Unless `SNYK_HTTP_PROTOCOL_UPGRADE` is set to `0`.

#### `SNYK_HTTP_PROTOCOL_UPGRADE=0`

If set to the value of `0`, API requests aimed at `http` URLs will not be upgraded to `https`. If not set, the default behavior will be to upgrade these requests from `http` to `https`. Useful e.g., for reverse proxies.

#### `HTTPS_PROXY` and `HTTP_PROXY`

Allows you to specify a proxy to use for `https` and `http` calls. The `https` in the `HTTPS_PROXY` means that _requests using `https` protocol_ will use this proxy. The proxy itself doesn't need to use `https`.

## Exit codes

Possible exit codes and their meaning:

**0**: success, no vulns found<br />
**1**: action_needed, vulns found<br />
**2**: failure, try to re-run command<br />
**3**: failure, no supported projects detected<br />

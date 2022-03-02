# Monitor

## Usage

`snyk monitor [<OPTIONS>]`

## Description

The `snyk monitor` command creates a project in your Synk account to be continuously monitored for open source vulnerabilities and license issues. After running this command, log in to the Snyk website and view your projects to see the monitor.

## Exit codes

Possible exit codes and their meaning:

**0**: success, snapshot created\
**1**: action_needed, vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and also set variables to configure the Snyk CLI to connect with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli).

## Debug

Use the `-d` option to output the debug logs.

## Options

See also subsequent sections for options for specific build environments, package managers, languages, and `[<CONTEXT-SPECIFIC OPTIONS>]` which you specify last.

### `--all-projects`

Auto-detect all projects in the working directory (including Yarn workspaces).

### `--detection-depth=<DEPTH>`

Use with `--all-projects` or `--yarn-workspaces` to indicate how many sub-directories to search. `DEPTH` must be a number.

Default: 4 (the current working directory and 3 sub-directories).

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories.

### `--exclude=<DIRECTORY>[,<DIRECTORY>]...>`

Can be used with `--all-projects` and `--yarn-workspaces` to indicate sub-directories and files to exclude. Must be comma separated.

Use the `--exclude` option with `--detection-depth` to ignore directories at any depth.

### `--prune-repeated-subdependencies`, `-p`

Prune dependency trees, removing duplicate sub-dependencies.

Continues to find all vulnerabilities, but may not find all of the vulnerable paths.

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository that you would like to monitor.

### `--dev`

Include development-only dependencies. Applicable only for some package managers, for example, `devDependencies` in npm or `:development` dependencies in Gemfile.

Default: scan only production dependencies.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_`ID`>`

Set a default to ensure all newly monitored projects are created under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account).

Example: `$ snyk test --org=my-team`

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI).

### `--file=<FILE>`

Specify a package file.

When testing locally or monitoring a project, you can specify the file that Snyk should inspect for package information. When the file is not specified, Snyk tries to detect the appropriate file for your project.

### --package-manager=\<PACKAGE_MANAGER_NAME>

Specify the name of the package manager when the filename specified with the `--file=<FILE>` option is not standard. This allows Snyk to find the file.

Example: `$ snyk test --file=req.txt --package-manager=pip`

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, Org level ignores, and the project policy on snyk.io.

### `--trust-policies`

Apply and use ignore rules from the Snyk policies your dependencies; otherwise ignore rules in the dependencies are only shown as a suggestion.

### `--show-vulnerable-paths=<none|some|all>`

Display the dependency paths from the top level dependencies down to the vulnerable packages. Does not affect output when using JSON `--json` output.

Default: `some` (a few example paths shown). `false` is an alias for `none`.

Example: `$ snyk test --show-vulnerable-paths=false`

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

Example: `$ snyk monitor --project-name=my-project`

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference which differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference. Only supported for Snyk Open Source. See [Separating projects by branch or version](https://snyk.info/3B0vTPs).

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results in JSON format.

### `--sarif`

Return results in SARIF format.

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment to one or more values (comma-separated). To clear the project environment set `--project-environment=`. Allowed values: `frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed`

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...>`

Set the project lifecycle to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`. Allowed values: `production, development, sandbox`

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`. Allowed values: `critical, high, medium, low`

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator), for example, `--project-tags=department=finance,team=alpha`. To clear the project tags set `--project-tags=`

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project-tags`.

## Options for Maven projects

For more information about Maven CLI options see [Snyk for Java (Gradle, Maven)](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven).

### `--scan-all-unmanaged`

Auto-detect maven jars, aars, and wars in given directory. To test individually use `--file=<JAR_FILE_NAME>`. **Note**: Custom-built jar files, even with open source dependencies, are out of scope.

### `--reachable`

Analyze your source code to find which vulnerable functions and packages are called. Cannot be used with `--all-projects`.

### `--reachable-timeout=<TIMEOUT>`

Specify the amount of time (in seconds) to wait for Snyk to gather reachability data. If it takes longer than `<TIMEOUT>`, reachable vulnerabilities are not reported. This does not affect regular test or monitor output.

Default: 300 (5 minutes).

## Options for Gradle projects

For more information about Gradle CLI options see [Snyk for Java (Gradle, Maven)](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven).

### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, test a specific sub-project.

### `--all-sub-projects`

For "multi project" configurations, test all sub-projects.

### `--configuration-matching=<CONFIGURATION_REGEX>`

Resolve dependencies using only configuration(s) that match the specified Java regular expression, for example, `^releaseRuntimeClasspath$`.

### `--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...`

Select certain values of configuration attributes to install dependencies and perform dependency resolution, for example, `buildtype:release,usage:java-runtime`.

### `--reachable`

Analyze your source code to find which vulnerable functions and packages are called.

### `--reachable-timeout=<TIMEOUT>`

Specify the amount of time (in seconds) to wait for Snyk to gather reachability data. If it takes longer than `<TIMEOUT>`, reachable vulnerabilities are not reported. This does not affect regular test or monitor output.

Default: 300 (5 minutes).

### `--init-script=<FILE`

Use for projects that contain a Gradle initialization script.

## Options for NuGet projects

### `--assets-project-name`

When monitoring a .NET project using NuGet `PackageReference` use the project name in `project.assets.json`, if found.

### `--packages-folder`

Specify a custom path to the packages folder.

### `--project-name-prefix=<PREFIX_STRING>`

When monitoring a .NET project, use this option to add a custom prefix to the name of files inside a project along with any desired separators, for example, `snyk monitor --file=my-project.sln --project-name-prefix=my-group/`. This is useful when you have multiple projects with the same name in other `.sln` files.

## Option for npm projects

### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: true

## Options for Yarn projects

### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: true

### `--yarn-workspaces`

Detect and scan Yarn workspaces. You can specify how many sub-directories to search using `--detection-depth` and exclude directories and files using `--exclude`. Alternatively scan Yarn workspaces with other projects using `--all-projects`.

## Option for CocoaPods projects

### `--strict-out-of-sync=true|false`

Control testing out of sync lockfiles.

Default: false

## Options for Python projects

### `--command=<COMMAND>`

Indicate which specific Python commands to use based on Python version. The default is `python` which executes your default python version. Run 'python -V' to find out what version it is. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python` Example: `--command=python3`

### `--skip-unresolved=true|false`

Allow skipping packages that are not found in the environment.

### `-- [<CONTEXT-SPECIFIC_OPTIONS>]`

Use context-specific options to pass extra arguments directly to Gradle, Maven, or other build tools. These options are specified last. Example: `snyk test -- --build-cache`

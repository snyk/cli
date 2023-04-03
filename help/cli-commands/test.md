# Test

## Usage

`snyk test [<OPTIONS>]`

## Description

The `snyk test` command checks projects for open source vulnerabilities and license issues. The test command tries to auto-detect supported manifest files with dependencies and test those.

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), no vulnerabilities found\
**1**: action_needed (scan completed), vulnerabilities found\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)

## Code execution warning

Before scanning your code, review the [Code execution warning for Snyk CLI](https://docs.snyk.io/snyk-cli/code-execution-warning-for-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

See also subsequent sections for options for specific build environments, package managers, languages, and `[<CONTEXT-SPECIFIC OPTIONS>]` which you specify last.

### `--all-projects`

Auto-detect all projects in the working directory (including Yarn workspaces).

For more information see the article [Does the Snyk CLI support monorepos or multiple manifest files?](https://support.snyk.io/hc/en-us/articles/360000910577-Does-the-Snyk-CLI-support-monorepos-or-multiple-manifest-files-)

If you see the invalid string length error, refer to [Invalid string length error when scanning projects](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/invalid-string-length-error-when-scanning-projects)

### `--fail-fast`

Use with `--all-projects` to cause scans to be interrupted when errors occur and to report these errors back to the user.

The exit code is 2 and the scan ends. No vulnerability information is reported for projects that did not produce errors.

To perform the scan, resolve the error and scan again.

**Note**: If you do not use `--fail-fast`, Snyk scans all the projects but does not report any vulnerabilities for projects it could not scan due to misconfiguration or another error.

### `--detection-depth=<DEPTH>`

Use with `--all-projects` or `--yarn-workspaces` to indicate how many subdirectories to search. `DEPTH` must be a number, 1 or greater; zero (0) is the current directory.

Default: 4 , the current working directory (0) and 4 subdirectories.

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories; zero (0) is the current directory.

### `--exclude=<NAME>[,<NAME>]...>`

Can be used with `--all-projects` and `--yarn-workspaces` to indicate directory names and file names to exclude. Must be comma separated.

Example: `$ snyk test --all-projects --exclude=dir1,file2`

This will exclude any directories and files named `dir1` and `file2` when scanning for project manifest files such as: `./dir1`, `./src/dir1`, `./file2`, `./src/file2` and so on.

### `--prune-repeated-subdependencies`, `-p`

Prune dependency trees, removing duplicate sub-dependencies.

Continues to find all vulnerabilities, but may not find all of the vulnerable paths.

Use this option if any big projects fail to be tested.

Default: false

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository that you would like to monitor.

### `--dev`

Include development-only dependencies. Applicable only for some package managers, for example, `devDependencies` in npm or `:development` dependencies in Gemfile.

**Note**: This option can be used with Maven, npm, and Yarn projects.

Default: false, scan only production dependencies.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/how-to-select-the-organization-to-use-in-the-cli)

### `--file=<FILE>`

Specify a package file.

When testing locally or monitoring a project, you can specify the file that Snyk should inspect for package information. When the file is not specified, Snyk tries to detect the appropriate file for your project.

See also the section on [Options for Python projects](https://docs.snyk.io/snyk-cli/commands/test#options-for-python-projects)

### `--package-manager=<PACKAGE_MANAGER_NAME>`

Specify the name of the package manager when the filename specified with the `--file=<FILE>` option is not standard. This allows Snyk to find the file.

Example: `$ snyk test --file=req.txt --package-manager=pip`

For more information see [Options for Python projects](https://docs.snyk.io/snyk-cli/commands/test#options-for-python-projects)

### `--unmanaged`

For C++ only, scan all files for known open source dependencies.

For options you can use with `--unmanaged` see [Options for scanning using `--unmanaged`](https://docs.snyk.io/snyk-cli/commands/test#options-for-scanning-using-unmanaged)

For more information see [Snyk for C/C++](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-c-c++)

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy on snyk.io.

### `--trust-policies`

Apply and use ignore rules from the Snyk policies in your dependencies; otherwise ignore rules in the dependencies are only shown as a suggestion.

### `--show-vulnerable-paths=<none|some|all>`

Display the dependency paths from the top level dependencies down to the vulnerable packages. Not supported with `--json-file-output`.

Default: `some` (a few example paths shown). `false` is an alias for `none`

Example: `--show-vulnerable-paths=none`

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference which differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference. Supported for Snyk Open Source except for use with `--unmanaged`.

For more information see [Separating projects by branch or version](https://docs.snyk.io/snyk-cli/secure-your-projects-in-the-long-term/grouping-projects-by-branch-or-version)

You can use `--target-reference=<TARGET_REFERENCE>` when running tests to apply the same ignores and policies as for a monitored target.

For more information see [Ignore issues](https://docs.snyk.io/features/fixing-and-prioritizing-issues/issue-management/ignore-issues)

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results on the console as a JSON data structure.

Example: `$ snyk test --json`

If you see the invalid string length error, refer to [Invalid string length error when scanning projects](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/invalid-string-length-error-when-scanning-projects)

### `--json-file-output=<OUTPUT_FILE_PATH>`

Save test output as a JSON data structure directly to the specified file, regardless of whether or not you use the `--json` option.

Use to display the human-readable test output using stdout and at the same time save the JSON data structure output to a file.

Example: `$ snyk test --json-file-output=vuln.json`

If you see the invalid string length error, refer to [Invalid string length error when scanning projects](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/invalid-string-length-error-when-scanning-projects)

### `--sarif`

Return results in SARIF format.

### `--sarif-file-output=<OUTPUT_FILE_PATH>`

Save test output in SARIF format directly to the \<OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.

This is especially useful if you want to display the human-readable test output using stdout and at the same time save the SARIF format output to a file.

### `--severity-threshold=<low|medium|high|critical>`

Report only vulnerabilities at the specified level or higher.

### `--fail-on=<all|upgradable|patchable>`

Fail only when there are vulnerabilities that can be fixed.

- `all`: fail when there is at least one vulnerability that can be either upgraded or patched.
- `upgradable`: fail when there is at least one vulnerability that can be upgraded.
- `patchable`: fail when there is at least one vulnerability that can be patched or vulnerabilities that can be either patched or upgraded.

To fail on any vulnerability (the default behavior), do not use the `--fail-on` option. If vulnerabilities do not have a fix and this option is being used, tests pass.

## Options for Maven projects

For more information see [CLI help for Maven Projects: Aggregate projects](https://docs.snyk.io/scan-application-code/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven#cli-help-for-maven-projects-aggregate-projects)

**Note**: The `--dev` option can be used with Maven projects. See also the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/test#dev)

### `--maven-aggregate-project`

Use `--maven-aggregate-project` instead of `--all-projects` when scanning Maven aggregate projects, that is, ones that use modules and inheritance.

When scanning these types of projects, Snyk performs a compile to ensure all modules are resolvable by the Maven reactor.

Be sure to run the scan in the same directory as the root pom.xml file.

Snyk reports test results per pom.xml file.

### `--scan-all-unmanaged`

Auto-detect maven jars, aars, and wars in given directory. To test individually use `--file=<JAR_FILE_NAME>`

**Note**: Custom-built jar files, even with open source dependencies, are out of scope.

## Options for Gradle projects

**Note:** If you see the invalid string length error, refer to [Invalid string length error when scanning projects](https://docs.snyk.io/snyk-cli/test-for-vulnerabilities/invalid-string-length-error-when-scanning-projects)

For more information see [CLI help for Gradle projects](https://docs.snyk.io/scan-application-code/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven#cli-help-for-gradle-projects)

### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, test a specific sub-project.

### `--all-sub-projects`

For "multi project" configurations, test all sub-projects.

### `--all-projects`

See also the `--all-projects` option information in the Options section of this help.

Use for monorepos. This detects all supported manifests.

For Gradle monorepos Snyk looks only for root level **build.gradle / build.gradle.kts** files and applies the same logic as `--all-sub-projects` behind the scenes.

This option is designed to be run in the root of your monorepo.

### `--configuration-matching=<CONFIGURATION_REGEX>`

Resolve dependencies using only configuration(s) that match the specified Java regular expression.

Example: `^releaseRuntimeClasspath$`

### `--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...`

Select certain values of configuration attributes to install and resolve dependencies.

Example: `buildtype:release,usage:java-runtime`

### `--init-script=<FILE>`

Use for projects that contain a Gradle initialization script.

## Options for NuGet projects

### `--assets-project-name`

When you are monitoring a .NET project using NuGet `PackageReference` uses the project name in `project.assets.json` if found.

### `--file=<filename>.sln`

Test all .NET projects included in the given `.sln` file. Projects referred to must have supported manifests. See [Snyk for .NET](https://docs.snyk.io/scan-application-code/snyk-open-source/snyk-open-source-supported-languages-and-package-managers/snyk-for-.net#snyk-cli-for-.net-projects)

Example: `snyk test --file=myApp.sln`

### `--file=packages.config`

Test an individual .NET project.

### `--packages-folder`

Specify a custom path to the packages folder.

This is the folder in which your dependencies are installed, provided you are using `packages.config`. If you have assigned a unique name to this folder, then Snyk can find it only if you enter a custom path.

Use the absolute or relative path, including the name of the folder where your dependencies reside.

Examples:

`snyk test --packages-folder=../location/to/packages` for Unix OS

`snyk test --packages-folder=..\location\to\packages` for Windows.

### `--project-name-prefix=<PREFIX_STRING>`

When monitoring a .NET project, use this option to add a custom prefix to the name of files inside a project along with any desired separators.

Example: `snyk monitor --file=my-project.sln --project-name-prefix=my-group/`

This is useful when you have multiple projects with the same name in other `.sln` files.

## Options for npm projects

**Note**: You can use the following options with npm projects:

`--dev`. See the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/test#dev)

`--all-projects` to scan and detect npm projects and all other projects in the directory. See the [`--all-projects` option help](https://docs.snyk.io/snyk-cli/commands/test#all-projects)

`--fail-on`. See the [--fail-on option help](https://docs.snyk.io/snyk-cli/commands/test#fail-on-less-than-all-or-upgradable-or-patchable-greater-than)

`--prune-repeated-subdependencies, -p`. See the [`--prune-repeated subdependencies` option help](https://docs.snyk.io/snyk-cli/commands/test#prune-repeated-subdependencies-p)

### `--strict-out-of-sync=true|false`

Prevent testing out-of-sync lockfiles.

If there are out-of-sync lockfiles in the project, the `test` command fails when `--strict-out-of-sync=true`.

Default: true

## Options for Yarn projects

**Note**: You can use the following options with Yarn projects:

`--dev`. See the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/test#dev)

`--fail-on`. See the [--fail-on option help](https://docs.snyk.io/snyk-cli/commands/test#fail-on-less-than-all-or-upgradable-or-patchable-greater-than)

`--prune-repeated-subdependencies, -p`. See the [`--prune-repeated subdependencies` option help](https://docs.snyk.io/snyk-cli/commands/test#prune-repeated-subdependencies-p)

### `--strict-out-of-sync=true|false`

Prevent testing out-of-sync lockfiles.

If there are out-of-sync lockfiles in the project, the `test` command fails when `--strict-out-of-sync=true`.

Default: true

### `--yarn-workspaces`

Detect and scan Yarn Workspaces only when a lockfile is in the root.

You can specify how many sub-directories to search using `--detection-depth.`

You can exclude directories and files using `--exclude`.

Default: `--all-projects` automatically detects and scans Yarn Workspaces.with other projects.

## Option for CocoaPods projects

### `--strict-out-of-sync=true|false`

Control testing out-of-sync lockfiles.

Default: false

## Options for Python projects

### `--command=<COMMAND>`

Indicate which specific Python commands to use based on the Python version.

Snyk uses Python in order to scan and find your dependencies. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python` This executes your default python version. Run `python -V` to find out what your default version is.

Example: `snyk test--command=python3`

### `--skip-unresolved=true|false`

Skip packages that cannot be found in the environment, for example, private packages that cannot be accessed from the machine running the scan.

### `--file=` for Python

For a Python project, specify a particular file to test.

Default: Snyk scans the requirements.txt file at the top level of the project.

Snyk can recognize any manifest files specified with this option based on `--file=req.txt`. Each (\*) is a wildcard and `req` can appear anywhere in the file name.

For example, Snyk recognizes your manifest file when you have renamed it to r`equirements-dev.txt`.

### `--package-manager=` for Python

Add`--package-manager=pip` to your command if the file name is not `requirements.txt`.

This option is mandatory if you specify a value for the `--file` parameter that is not to a `requirements.txt` file. The test fails without this parameter. Specify this parameter with the value `pip`.

For complete information about the command see [`--package-manager=<PACKAGE_MANAGER_NAME>`](https://docs.snyk.io/snyk-cli/commands/test#package-manager-less-than-package_manager_name-greater-than)\`\`

## Options for Go projects

Currently the following options are not supported:

`--fail-on=<all|upgradable|patchable>`

## Options for scanning using `--unmanaged`

The following standard `snyk test` options can be used with `--unmanaged` as documented in this help.

`--org=<ORG_ID>`

`--json`

`--json-file-output=<OUTPUT_FILE_PATH>`

`--remote-repo-url=<URL>`

`--severity-threshold=<low|medium|high|critical>`

There are also special options as follows.

### `--max-depth`

Specify the maximum level of archive extraction.

Usage: `--max-depth=1`

Use 0 (zero, the default) to disable archive extraction completely.

### `--print-dep-paths`

Display dependencies.

Use use this option to see what files contributed to each dependency identified.

To see how confident Snyk is about the identified dependency and its version, use the `--print-deps` or `--print-dep-paths` option.

For more information on uses of CLI options for C/C++ projects see [Snyk for C / C++](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-c-c++)

## Options for build tools

### `-- [<CONTEXT-SPECIFIC_OPTIONS>]`

Use a double dash (`--`) after the complete Snyk command to pass additional options (arguments, flags) that follow directly to the build tool, for example Gradle or Maven.

The format is `snyk <command> -- [<context-specific_options>]`

Example: `snyk test -- --build-cache`

**Note:** Do not use double quotes in any `-- [<context-specific_options>]`.

Example: Use `snyk test --org=myorg -- -s settings.xml`

NOT `snyk test --org=myorg -- "-s settings.xml"`

See also [Examples of how you can use Maven arguments with the Snyk CLI](https://docs.snyk.io/scan-application-code/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven#examples-of-how-you-can-use-maven-arguments-with-the-snyk-cli)

## Examples for the snyk test command

Test a project in the current folder for known vulnerabilities:

`$ snyk test`

Test a specific dependency for vulnerabilities (**npm** only):

`$ snyk test ionic@1.6.5`

Test the latest version of an **npm** package:

`$ snyk test lodash`

Test a public GitHub repository:

`$ snyk test https://github.com/snyk-labs/nodejs-goof`

# Monitor

## Usage

`snyk monitor [<OPTIONS>]`

## Description

The `snyk monitor` command creates a project in your Snyk account to be continuously monitored for open-source vulnerabilities and license issues, sending the results to [snyk.io](https://snyk.io)

Use the `monitor` command command before integrating a project into production, to take a snapshot of the code to be monitored in order to avoid pushing vulnerabilities into production. Choose a test frequency in your Settings if you want to change the frequency from the default, which is daily.

A PR check will also do a test.

After running the `snyk monitor` command, log in to the Snyk website and view your projects to see the monitor.

If you make changes to your code, you must run the `monitor` command again.

For Snyk Container, see [`snyk container` help](https://docs.snyk.io/snyk-cli/commands/container)

The `monitor` command is not supported for Snyk Code.

For Snyk Infrastructure as Code follow the instructions in "Regularly testing IaC files" on [Snyk CLI for IaC](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-iac)

## Exit codes

Possible exit codes and their meaning:

**0**: success, snapshot created\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Code execution warning

Before scanning your code, review the [Code execution warning for Snyk CLI](https://docs.snyk.io/snyk-cli/code-execution-warning-for-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

See also subsequent sections for options for specific build environments, package managers, languages and `[<CONTEXT-SPECIFIC OPTIONS>]` which you specify last.

### `--all-projects`

Auto-detect all projects in the working directory, including Yarn workspaces.

For more information see the article [Does the Snyk CLI support monorepos or multiple manifest files?](https://support.snyk.io/hc/en-us/articles/360000910577-Does-the-Snyk-CLI-support-monorepos-or-multiple-manifest-files-)

### `--fail-fast`

Use with `--all-projects` to cause scans to be interrupted when errors occur and to report these errors back to the user.

The exit code is 2 and the scan ends. No vulnerability information is reported for projects that did not produce errors.

To perform the scan, resolve the error and scan again.

**Note**: If you do not use `--fail-fast`, Snyk scans all the projects but does not report any vulnerabilities for projects it could not scan due to misconfiguration or another error.

### `--detection-depth=<DEPTH>`

Use with `--all-projects` or `--yarn-workspaces` to indicate how many subdirectories to search. `DEPTH` must be a number, `1` or greater; zero (0) is the current directory.

Default: 4, the current working directory (0) and 4 subdirectories.

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories; zero (0) is the current directory.

### `--exclude=<NAME>[,<NAME>]...>`

Can be used with `--all-projects` and `--yarn-workspaces` to indicate directory names and file names to exclude. Must be comma-separated, and cannot include a path.

Example: `$ snyk test --all-projects --exclude=dir1,file2`

This will exclude any directories and files named `dir1` and `file2` when scanning for project manifest files such as: `./dir1`, `./src/dir1`, `./file2`, `./src/file2` and so on.

**Note**: `--exclude=dir1` will find both `./dir1`, and `./src/dir1`.\
However, `--exclude=./src/dir1` will result in an error because it includes a path.

### `--prune-repeated-subdependencies`, `-p`

Prune dependency trees, removing duplicate sub-dependencies.

Continues to find all vulnerabilities, but may not find all of the vulnerable paths.

Use this option if any big projects fail to be tested.

Default: false

### `--print-deps`

Print the dependency tree before sending it for analysis.

### `--remote-repo-url=<URL>`

Set or override the remote URL for the repository that you would like to monitor.

Groups all Projects found under a single Target.

### `--dev`

Include development-only dependencies. Applicable only for some package managers, for example, `devDependencies` in npm or `:development` dependencies in Gemfile.

**Note**: This option can be used with Maven, npm, and Yarn projects.

Default: false, scan only production dependencies.

### `--org=<ORG_ID>`

Specify the `<ORG_ID>` to run Snyk commands tied to a specific Snyk Organization. The `<ORG_ID>` influences some features availability and private test limits.

If you have multiple Organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_`ID`>`

Set a default to ensure all newly monitored projects are created under your default Organization. If you need to override the default, use the `--org=<ORG_ID>` option.

Default: `<ORG_ID>` that is the current preferred Organization in your [Account settings](https://app.snyk.io/account)

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The Organization slug name works in the CLI, but not in the API.

`orgslugname` must match the slug name as displayed in the URL of your org in the Snyk UI: `https://app.snyk.io/org/[orgslugname]`. The orgname does not work.

For more information see the article [How to select the Organization to use in the CLI](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/how-to-select-the-organization-to-use-in-the-cli)

### `--file=<FILE>`

Specify a package file.

When testing locally or monitoring a project, you can specify the file that Snyk should inspect for package information. When the file is not specified, Snyk tries to detect the appropriate file for your project.

See also the section on [Options for Python projects](https://docs.snyk.io/snyk-cli/commands/monitor#options-for-python-projects)

### `--package-manager=<PACKAGE_MANAGER_NAME>`

Specify the name of the package manager when the filename specified with the `--file=<FILE>` option is not standard. This allows Snyk to find the file.

Example: `$ snyk monitor --file=req.txt --package-manager=pip`

For more information see [Options for Python projects](https://docs.snyk.io/snyk-cli/commands/monitor#options-for-python-projects)

### `--unmanaged`

For C++ only, scan all files for known open source dependencies.

For options you can use with `--unmanaged` see [Options for scanning using `--unmanaged`](https://docs.snyk.io/snyk-cli/commands/monitor#options-for-scanning-using-unmanaged)

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy on snyk.io.

### `--trust-policies`

Apply and use ignore rules from the Snyk policies in your dependencies; otherwise ignore rules in the dependencies are only shown as a suggestion.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

Example: `$ snyk monitor --project-name=my-project`

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference that differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference. Supported for Snyk Open Source and use with `--unmanaged`.

For more information see [Group projects by branch or version for monitoring](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/group-projects-by-branch-or-version-for-monitoring)

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results on the console as a JSON data structure.

**Note**: If you use an option that sets project attributes and your role lacks permission to edit project attributes the `monitor` command fails. For instructions on how to proceed see [Permissions (role) required to edit Project attributes from the Snyk CLI](https://docs.snyk.io/snyk-admin/manage-permissions-and-roles/manage-member-roles#permissions-role-required-to-edit-project-attributes-from-the-snyk-cli)

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment project attribute to one or more values (comma-separated). To clear the project environment set `--project-environment=`

Allowed values: `frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...>`

Set the project lifecycle project attribute to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`

Allowed values: `production, development, sandbox`

For more information see [Project attributes](https://docs.snyk.io/snyk-admin/snyk-projects/project-tags)

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality project attribute to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`

Allowed values: `critical, high, medium, low`

For more information see [Project attributes](https://docs.snyk.io/snyk-admin/snyk-projects/project-tags)

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator).

Example, `--project-tags=department=finance,team=alpha`

To clear the project tags set `--project-tags=`

For more information including allowable characters see [Project tags](https://docs.snyk.io/snyk-admin/snyk-projects/project-tags)

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project-tags`

## Options for Maven projects

**Note**: The `--dev` option can be used with Maven projects. See also the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/monitor#dev)

### `--maven-aggregate-project`

Use `--maven-aggregate-project` instead of `--all-projects` when scanning Maven aggregate projects, that is, projects that use modules and inheritance.

Using `--maven-aggregate-project` instructs Snyk to perform a compilation step to ensure all modules within the project are resolvable by the Maven reactor. This ensures a comprehensive scan that includes dependencies of all sub-modules.

Be sure to run the scan in the same directory as the root `pom.xml` file.

Snyk reports the test results per individual `pom.xml` file within the aggregate project.

**Note:** You can use `--all-projects` when scanning Maven aggregate projects, but you cannot use `--all-projects` with `--maven-aggregate-project`.

### `--scan-unmanaged`

To monitor individual JAR, WAR, and AAR files, use the following:

```
--scan-unmanaged --file=<JAR_FILE_NAME>
```

### `--scan-all-unmanaged`

Auto-detect Maven, JAR, WAR, and AAR files recursively from the current folder.

```
--scan-all-unmanaged
```

**Note**: Custom-built JAR files, even with open-source dependencies, are not supported.

## Options for Gradle projects

### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, monitor a specific sub-project.

### `--all-sub-projects`

For "multi project" configurations, monitor all sub-projects.

Both a build.gradle file and a settings.gradle file, or equivalent files, based on the package manager, must exist in the current directory.

### `--configuration-matching=<CONFIGURATION_REGEX>`

Resolve dependencies using the first configuration that matches the specified Java regular expression.

Example: `^releaseRuntimeClasspath$`

### `--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...`

Select certain values of configuration attributes to install dependencies and perform dependency resolution.

Example: `buildtype:release,usage:java-runtime`

### `--init-script=<FILE`

Use for projects that contain a Gradle initialization script.

## Options for NuGet projects

### `--assets-project-name`

When you are monitoring a .NET project using NuGet `PackageReference` uses the project name in `project.assets.json` if found.

### `--packages-folder`

Specify a custom path to the packages folder.

### `--project-name-prefix=<PREFIX_STRING>`

When monitoring a .NET project, use this option to add a custom prefix to the name of files inside a project along with any desired separators.

Example: `snyk monitor --file=my-project.sln --project-name-prefix=my-group/`

This is useful when you have multiple projects with the same name in other `.sln` files.

## Options for .NET projects

### `--dotnet-runtime-resolution`

**Note:** This option in in Early Access and may change until it is released.

Required. You must use this option when you test .NET projects using [Runtime Resolution Scanning](https://docs.snyk.io/getting-started/supported-languages-and-frameworks/.net/improved-.net-scanning)

Example: `snyk test --dotnet-runtime-resolution`

### `--dotnet-target-framework`

**Note:** This option in in Early Access and may change until it is released.

Optional. You may use this option if your solution contains multiple `<TargetFramework>` directives. If you do not specify the option `--dotnet-target-framework`, all supported Target Frameworks will be scanned.

The Target Framework specified with this option should be defined following the standard [naming convention](https://learn.microsoft.com/en-us/dotnet/standard/frameworks#supported-target-frameworks)

Example: `snyk test --dotnet-runtime-resolution --dotnet-target-framework=net6.0`

## Options for npm projects

**Note**: You can use the following options with npm projects:

`--dev`. See the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/monitor#dev)

`--all-projects` to scan and detect npm projects and all other projects in the directory. See the [`--all-projects` option help](https://docs.snyk.io/snyk-cli/commands/monitor#all-projects)

`--prune-repeated-subdependencies, -p`. See the [--prune-repeated subdependencies option help](https://docs.snyk.io/snyk-cli/commands/monitor#prune-repeated-subdependencies-p)

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: true

## Options for pnpm projects

**Snyk CLI pnpm support is in Early Access**. To enable it, in your Snyk account navigate to Settings, select Snyk Preview, and install CLI v1.1293.0 or above.

**Note**: You can use the following options with pnpm projects:

`--dev`. See the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/monitor#dev)

`--all-projects` to scan and detect pnpm projects and all other projects in the directory. See the [`--all-projects` option help](https://docs.snyk.io/snyk-cli/commands/monitor#all-projects)

`--prune-repeated-subdependencies, -p`. See the [--prune-repeated subdependencies option help](https://docs.snyk.io/snyk-cli/commands/monitor#prune-repeated-subdependencies-p)

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: true

## Options for Yarn projects

**Note**: You can use the following options with Yarn projects:

`--dev.` See the [`--dev` option help](https://docs.snyk.io/snyk-cli/commands/monitor#dev)

`--prune-repeated-subdependencies, -p.` See the [--prune-repeated subdependencies option help](https://docs.snyk.io/snyk-cli/commands/monitor#prune-repeated-subdependencies-p)

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: true

### `--yarn-workspaces`

Detect and scan only Yarn Workspaces when a lockfile is in the root.

You can specify how many sub-directories to search using `--detection-depth`.

You can exclude directories and files using `--exclude`.

Default:`--all-projects` automatically detects and scans Yarn Workspaces.with other projects.

## Option for CocoaPods projects

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: false

## Options for Python projects

### `--command=<COMMAND>`

Indicate which specific Python commands to use based on the Python version.

Snyk uses Python in order to scan and find your dependencies. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python` This executes your default python version. Run `python -V` to find out what your default version is.

Example: `snyk monitor --command=python3`

### `--skip-unresolved=true|false`

Skip packages that cannot be found in the environment, for example, private packages that cannot be accessed from the machine running the scan.

### `--file=<FILE_for_Python>`

For a Python project, specify a particular file to monitor.

Default: Snyk scans the requirements.txt file at the top level of the project.

Snyk can recognize any manifest files specified with this option based on `--file=req*.txt`. The `*` is a wildcard and `req` can appear anywhere in the file name.

For example, Snyk recognizes your manifest file when you have renamed it to `requirements-dev.txt`.

### `--package-manager=pip`

Add`--package-manager=pip` to your command if the file name is not `requirements.txt`.

This option is mandatory if you specify a value for the `--file` parameter that is not to a `requirements.txt` file. The test fails without this parameter. Specify this parameter with the value `pip`.

For complete information about the command see [`--package-manager=<PACKAGE_MANAGER_NAME>`](https://docs.snyk.io/snyk-cli/commands/monitor#package-manager-less-than-package_manager_name-greater-than)\`\`

## Options for scanning using `--unmanaged`

The following `snyk monitor` options can be used with `--unmanaged` as documented in this help.

`--org=<ORG_ID>`

`--json`

`--remote-repo-url=<URL>`

`--target-reference=<TARGET_REFERENCE>`

`--project-name=<c-project>`

There are also special options.

### `--max-depth`

Specify the maximum level of archive extraction.

Usage: `--max-depth=1`

Use 0 (zero, the default) to disable archive extraction completely.

### `--print-dep-paths`

Display dependencies.

Use this option to see what files contributed to each dependency identified.

To see how confident Snyk is about the identified dependency and its version, use the `--print-deps` or `--print-dep-paths` option.

## Options for build tools

### `-- [<CONTEXT-SPECIFIC_OPTIONS>]`

Use a double dash (`--`) after the complete Snyk command to pass options (arguments, flags) that follow directly to the build tool, for example Gradle or Maven.

The format is `snyk <command> -- [<context-specific_options>]`

Example: `snyk monitor -- --build-cache`

**Note:** Do not use double quotes in any `-- [<context-specific_options>]`.

Example: Use `snyk monitor --org=myorg -- -s settings.xml` NOT `snyk monitor --org=myorg -- "-s settings.xml"`

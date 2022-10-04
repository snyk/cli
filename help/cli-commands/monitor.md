# Monitor

## Usage

`snyk monitor [<OPTIONS>]`

## Description

The `snyk monitor` command creates a project in your Snyk account to be continuously monitored for open source vulnerabilities and license issues. After running this command, log in to the Snyk website and view your projects to see the monitor.

For Snyk Container see [`snyk container` help](https://docs.snyk.io/snyk-cli/commands/container)

The `monitor` command is not supported for Snyk Code.

For Snyk Infrastructure as Code follow the instructions in "Regularly testing IaC files" on [Snyk CLI for Infrastructure as Code](https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code)

## Exit codes

Possible exit codes and their meaning:

**0**: success, snapshot created\
**2**: failure, try to re-run command\
**3**: failure, no supported projects detected

## Configure the Snyk CLI

You can use environment variables to configure the Snyk CLI and and set variables for connecting with the Snyk API. See [Configure the Snyk CLI](https://docs.snyk.io/features/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Options

See also subsequent sections for options for specific build environments, package managers, languages and `[<CONTEXT-SPECIFIC OPTIONS>]` which you specify last.

### `--all-projects`

Auto-detect all projects in the working directory (including Yarn workspaces).

For more information see the article [Does the Snyk CLI support monorepos or multiple manifest files?](https://support.snyk.io/hc/en-us/articles/360000910577-Does-the-Snyk-CLI-support-monorepos-or-multiple-manifest-files-)

### `--fail-fast`

Use with `--all-projects` to cause scans to be interrupted when errors occur and to report these errors back to the user.

The exit code is 2 and the scan ends. No vulnerability information is reported for projects that did not produce errors.

To perform the scan, resolve the error and scan again.

Note: If you do not use `--fail-fast`, Snyk scans all the projects but does not report any vulnerabilities for projects it could not scan due to misconfiguration or another error.

### `--detection-depth=<DEPTH>`

Use with `--all-projects` or `--yarn-workspaces` to indicate how many subdirectories to search. `DEPTH` must be a number, `1` or greater; zero (0) is the current directory.

Default: 4, the current working directory (0) and 4 subdirectories.

Example: `--detection-depth=3` limits search to the specified directory (or the current directory if no `<PATH>` is specified) plus three levels of subdirectories; zero (0) is the current directory.

### `--exclude=<NAME>[,<NAME>]...>`

Can be used with `--all-projects` and `--yarn-workspaces` to indicate directory names and file names to exclude. Must be comma separated.

Example: `$ snyk test --all-projects --exclude=dir1,file2`

This will exclude any directories and files named `dir1` and `file2` when scanning for project manifest files such as: `./dir1`, `./src/dir1`, `./file2`, `./src/file2` and so on.

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

Default: `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Note that you can also use `--org=<orgslugname>`. The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `--file=<FILE>`

Specify a package file.

When testing locally or monitoring a project, you can specify the file that Snyk should inspect for package information. When the file is not specified, Snyk tries to detect the appropriate file for your project.

### `--package-manager=<PACKAGE_MANAGER_NAME>`

Specify the name of the package manager when the filename specified with the `--file=<FILE>` option is not standard. This allows Snyk to find the file.

Example: `$ snyk monitor --file=req.txt --package-manager=pip`

### `--unmanaged`

For C++ only, scan all files for known open source dependencies.

For options you can use with `--unmanaged` see [Options for scanning using `--unmanaged`](https://docs.snyk.io/snyk-cli/commands/monitor#options-for-scanning-using-unmanaged)

For more information see [Snyk for C/C++](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-c-c++)

### `--ignore-policy`

Ignore all set policies, the current policy in the `.snyk` file, org level ignores, and the project policy on snyk.io.

### `--trust-policies`

Apply and use ignore rules from the Snyk policies in your dependencies; otherwise ignore rules in the dependencies are only shown as a suggestion.

### `--project-name=<PROJECT_NAME>`

Specify a custom Snyk project name.

Example: `$ snyk monitor --project-name=my-project`

### `--target-reference=<TARGET_REFERENCE>`

Specify a reference which differentiates this project, for example, a branch name or version. Projects having the same reference can be grouped based on that reference. Supported for Snyk Open Source and use with `--unmanaged`.

For more information see [Separating projects by branch or version](https://docs.snyk.io/snyk-cli/secure-your-projects-in-the-long-term/grouping-projects-by-branch-or-version)

### `--policy-path=<PATH_TO_POLICY_FILE>`

Manually pass a path to a `.snyk` policy file.

### `--json`

Print results on the console as a JSON data structure.

Note: If you use an option that sets project attributes and your role lacks permission to edit project attributes the `monitor` command fails. For instructions on how to proceed see [Editing project attributes from the Snyk CLI](https://docs.snyk.io/features/user-and-group-management/managing-users-and-permissions/managing-permissions#editing-project-attributes-from-the-snyk-cli)

### `--project-environment=<ENVIRONMENT>[,<ENVIRONMENT>]...>`

Set the project environment project attribute to one or more values (comma-separated). To clear the project environment set `--project-environment=`

Allowed values: `frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

### `--project-lifecycle=<LIFECYCLE>[,<LIFECYCLE>]...>`

Set the project lifecycle project attribute to one or more values (comma-separated). To clear the project lifecycle set `--project-lifecycle=`

Allowed values: `production, development, sandbox`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

### `--project-business-criticality=<BUSINESS_CRITICALITY>[,<BUSINESS_CRITICALITY>]...>`

Set the project business criticality project attribute to one or more values (comma-separated). To clear the project business criticality set `--project-business-criticality=`

Allowed values: `critical, high, medium, low`

For more information see [Project attributes](https://docs.snyk.io/getting-started/introduction-to-snyk-projects/view-project-information/project-attributes)

### `--project-tags=<TAG>[,<TAG>]...>`

Set the project tags to one or more values (comma-separated key value pairs with an "=" separator), for example, `--project-tags=department=finance,team=alpha` To clear the project tags set `--project-tags=`

### `--tags=<TAG>[,<TAG>]...>`

This is an alias for `--project-tags`

## Options for Maven projects

For more information about Maven CLI options see [Snyk for Java and Kotlin](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven)

### `--maven-aggregate-project`

Use `--maven-aggregate-project` instead of `--all-projects` when scanning Maven aggregate projects, that is, ones that use modules and inheritance.

When scanning these types of projects, Snyk performs a compile to ensure all modules are resolvable by the Maven reactor.&#x20;

Be sure to run the scan in the same directory as the root pom.xml file.&#x20;

Snyk reports test results per pom.xml file.

### `--scan-all-unmanaged`

Auto-detect maven jars, aars, and wars in given directory. To monitor individually use `--file=<JAR_FILE_NAME>`

**Note**: Custom-built jar files, even with open source dependencies, are out of scope.

## Options for Gradle projects

For more information about Gradle CLI options see [Snyk for Java and Kotlin](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven)

### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, monitor a specific sub-project.

### `--all-sub-projects`

For "multi project" configurations, monitor all sub-projects.

### `--configuration-matching=<CONFIGURATION_REGEX>`

Resolve dependencies using only configuration(s) that match the specified Java regular expression.

Example: `^releaseRuntimeClasspath$`

### `--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]...`

Select certain values of configuration attributes to install dependencies and perform dependency resolution.

Example: `buildtype:release,usage:java-runtime`

### `--init-script=<FILE`

Use for projects that contain a Gradle initialization script.

## Options for NuGet projects

### `--assets-project-name`

When monitoring a .NET project using NuGet `PackageReference` use the project name in `project.assets.json`, if found.

### `--packages-folder`

Specify a custom path to the packages folder.

### `--project-name-prefix=<PREFIX_STRING>`

When monitoring a .NET project, use this option to add a custom prefix to the name of files inside a project along with any desired separators.

Example: `snyk monitor --file=my-project.sln --project-name-prefix=my-group/`

This is useful when you have multiple projects with the same name in other `.sln` files.

## Option for npm projects

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: true

## Options for Yarn projects

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: true

### `--yarn-workspaces`

Detect and scan Yarn workspaces. You can specify how many sub-directories to search using `--detection-depth` and exclude directories and files using `--exclude`. Alternatively scan Yarn workspaces with other projects using `--all-projects`

## Option for CocoaPods projects

### `--strict-out-of-sync=true|false`

Control monitoring out-of-sync lockfiles.

Default: false

## Options for Python projects

### `--command=<COMMAND>`

Indicate which specific Python commands to use based on Python version. The default is `python` which executes your default python version. Run 'python -V' to find out what version it is. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python` Example: `--command=python3`

### `--skip-unresolved=true|false`

Allow skipping packages that are not found in the environment.

## Options for scanning using `--unmanaged`

The following `snyk monitor` options can be used with `--unmanaged` as documented in this help.

`--org=<ORG_ID>`

`--json`

`--remote-repo-url=<URL>`

`--target-reference=<TARGET_REFERENCE>`

There are also special options.

### `--max-depth`

Specify the maximum level of archive extraction.

Usage: `--max-depth=1`&#x20;

Use 0 (zero, the default) to disable archive extraction completely.

### `--print-dep-paths`

Display dependencies.

Use use this option to see what files contributed to each dependency identified.

To see how confident Snyk is about the identified dependency and its version, use the `--print-deps` or `--print-dep-paths` option.

For more information on uses of CLI options for C/C++ projects see [Snyk for C / C++](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-c-c++)

### `--project-name=c-project`

Use with the `snyk monitor --unmanaged` command to override the default name Snyk gives your snapshots by entering the desired name.

## Options for build tools

### `-- [<CONTEXT-SPECIFIC_OPTIONS>]`

Use a double dash (`--`) after the complete Snyk command to pass options (arguments, flags) that follow directly to the build tool, for example Gradle or Maven.

The format is `snyk <command> -- [<context-specific_options>]`

Example: `snyk monitor -- --build-cache`

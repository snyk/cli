# SBOM

## Prerequisites

**Feature availability:** This feature is available to customers on Snyk Enterprise plans.

**Note:** In order to run the SBOM generation feature, you must use a minimum of CLI version 1.1071.0.

The `snyk sbom` feature requires an internet connection.

## Usage

`$ snyk sbom --format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json> [--file=<FILE>] [--unmanaged] [--org=<ORG_ID>] [--dev] [--all-projects] [--name=<NAME>] [--version=<VERSION>] [--exclude=<NAME>[,<NAME>...]] [--detection-depth=<DEPTH>] [--prune-repeated-subdependencies|-p] [--maven-aggregate-project] [--scan-unmanaged] [--scan-all-unmanaged] [--sub-project=<NAME>] [--gradle-sub-project=<NAME>] [--all-sub-projects] [--configuration-matching=<CONFIGURATION_REGEX>] [--configuration-attributes=<ATTRIBUTE>[,<ATTRIBUTE>]] [--init-script=<FILE>] [--json-file-output=<OUTPUT_FILE_PATH>] [<TARGET_DIRECTORY>]`

## Description

The `snyk sbom` command generates an SBOM for a local software project in an ecosystem supported by Snyk.

Supported formats include CycloneDX v1.4 (JSON or XML) and SPDX v2.3 (JSON).

An SBOM can be generated for all supported Open Source package managers as well as unmanaged software projects.

## Exit codes

Possible exit codes and their meaning:

**0**: success (process completed), SBOM created successfully\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Debug

Use the `-d` or `--debug` option to output the debug logs.

## Options

### `--format=<cyclonedx1.4+json|cyclonedx1.4+xml|spdx2.3+json>`

Required. Specify the output format for the SBOM to be produced.

Set the desired SBOM output format. Available options are `cyclonedx1.4+json`, `cyclonedx1.4+xml`, and `spdx2.3+json`

### `[--org=<ORG_ID>]`

Specify the `<ORG_ID>` (name or UUID) to run Snyk commands tied to a specific organization. The `<ORG_ID>` influences some features availability and private test limits.

Use this option when your default organization does not have API entitlement.

If this option is omitted, the default organization for your account will be used.

This is the `<ORG_ID>` that is the current preferred organization in your [Account settings](https://app.snyk.io/account)

Set a default to ensure all newly tested projects are tested under your default organization. If you need to override the default, use the `--org=<ORG_ID>` option.

If you have multiple organizations, you can set a default from the CLI using:

`$ snyk config set org=<ORG_ID>`

**Note:** You can also use `--org=<orgslugname>.` The `ORG_ID` works in both the CLI and the API. The organization slug name works in the CLI, but not in the API.

For more information see the article [How to select the organization to use in the CLI](https://support.snyk.io/hc/en-us/articles/360000920738-How-to-select-the-organization-to-use-in-the-CLI)

### `[--file=<file>] or [--f=<file>]`

Specify the desired manifest file on which the SBOM will be based.

By default, the `sbom` command detects a supported manifest file in the current working directory.

### `[--unmanaged]`

Generate an SBOM for unmanaged software projects.

### `[--dev]`

Include development-only dependencies in the SBOM output.

Applicable only for some package managers, for example, `devDependencies` in npm or `:development` dependencies in Gemfile.

When `--dev` is used with the SPDX format, the development-only dependencies are included in the `DEV_DEPENDENCY_OF` relationship.

When `--dev` is used with the CycloneDX format, development-only dependencies are not labeled differently from non-development dependencies.

**Note**: This option can be used with Maven, npm, and Yarn projects.

### `[--all-projects]`

Optional. Use for monorepos and directories with multiple projects or manifest files.

Auto-detect all projects in the working directory (including Yarn workspaces) and generate a single SBOM based on their contents.

### `[--name=<NAME>]`

Use in combination with `--all-projects` to provide the name of the software which the SBOM describes. If not specified, this defaults to the name of current working directory.

### `[--version=<VERSION>]`

Use in combination with `--all-projects` to provide the version of the software which the SBOM describes. This is omitted if not set explicitly.

### `[--exclude=<NAME>[,<NAME>...]]`

Can be used with `--all-projects` to indicate directory names and file names to exclude. Must be comma separated.

Example: `$ snyk sbom --all-projects --exclude=dir1,file2`

This will exclude any directories named `dir1` and `file2` when scanning for project manifest files.

**Note**: `--exclude=dir1` will find both `./dir1`, and `./src/dir1`.\
However, `--exclude=./src/dir1` will result in an error because it includes a path.

**Note**: When `--all-projects` is used with Gradle, the projects are treated as sub-projects. The `--exclude` option is not supported for Gradle sub-projects.

### `[--detection-depth=<DEPTH>]`

Use with `--all-projects` to indicate how many subdirectories to search. `DEPTH` must be a number, 1 or greater; zero (0) is the current directory.

Default: 4

### `[--prune-repeated-subdependencies|-p]`

Prune dependency trees, removing duplicate sub-dependencies.

### `[<TARGET_DIRECTORY>]`

Optional. Instruct the CLI to autodetect a package manager manifest file to use within the specified directory. If `--file` is set, this option will be ignored.

### `[--json-file-output]`

Optional. Save the SBOM output as a JSON data structure directly to the specified file. This requires the SBOM `--format` to include `+json`.

## Options for Maven projects

### `--maven-aggregate-project`

Use `--maven-aggregate-project` instead of `--all-projects` when scanning Maven aggregate projects, that is, ones that use modules and inheritance.

When scanning these types of projects, Snyk performs a compile to ensure all modules are resolvable by the Maven reactor.

Be sure to run the scan in the same directory as the root pom.xml file.

### `--scan-unmanaged`

To scan individual JAR, WAR, or AAR files, use the following:

`--scan-unmanaged --file=<JAR_FILE_NAME>`

### `--scan-all-unmanaged`

Auto-detect Maven, JAR, WAR, and AAR files recursively from the current folder.

**Note**: Custom-built JAR files, even with open-source dependencies, are not supported.

## Options for Gradle projects

### `--sub-project=<NAME>`, `--gradle-sub-project=<NAME>`

For Gradle "multi project" configurations, scan a specific sub-project.

### `--all-sub-projects`

For "multi project" configurations, scan all sub-projects.

### `--all-projects`

See also the `--all-projects` option information in the Options section of this help.

Use for monorepos. This detects all supported manifests.

For Gradle monorepos Snyk looks only for root level `build.gradle` and `build.gradle.kts` files and applies the same logic as `--all-sub-projects` behind the scenes.

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

When you are monitoring a .NET project using NuGet `PackageReference`, use the project name in `project.assets.json` if found.

### `--file=<filename>.sln`

Test all .NET projects included in the given `.sln` file. Projects referred to must have supported manifests.

### `--file=packages.config`

Test an individual .NET project.

### `--packages-folder`

Specify a custom path to the packages folder.

This is the folder in which your dependencies are installed, provided you are using `packages.config`. If you have assigned a unique name to this folder, then Snyk can find it only if you enter a custom path.

Use the absolute or relative path, including the name of the folder where your dependencies reside.

## Options for npm projects

### `--strict-out-of-sync=true|false`

Prevent testing out-of-sync lockfiles.

To use this option, you must use a minimum CLI version of 1.1228.0.

If there are out-of-sync lockfiles in the project, the `sbom` command fails when `--strict-out-of-sync=true`.

Default: true

## Options for Yarn projects

### `--strict-out-of-sync=true|false`

Prevent testing out-of-sync lockfiles.

If there are out-of-sync lockfiles in the project, the `sbom` command fails when `--strict-out-of-sync=true`.

Default: true

### `--yarn-workspaces`

Detect and scan Yarn Workspaces only when a lockfile is in the root.

You can specify how many sub-directories to search using `--detection-depth`.

You can exclude directories and files using `--exclude`.

Default: `--all-projects` automatically detects and scans Yarn Workspaces with other projects.

## Options for Python projects

### `--command=<COMMAND>`

Indicate which specific Python commands to use based on the Python version.

Snyk uses Python in order to scan and find your dependencies. If you are using multiple Python versions, use this parameter to specify the correct Python command for execution.

Default: `python` This executes your default python version. Run `python -V` to find out what your default version is.

Example: `snyk sbom --command=python3`

### `--skip-unresolved=true|false`

Skip packages that cannot be found in the environment, for example, private packages that cannot be accessed from the machine running the scan.

### `--file=<filename>`

For a Python project, specify a particular file to test.&#x20;

Default: Snyk scans the `requirements.txt` file at the top level of the project.

When setting this option for Python values, it is required to also set the `--package-manager` option. See below.

### `--package-manager=<package manager>`

Add `--package-manager=pip` to your command if the file name is not `requirements.txt`.

This option is mandatory if you specify a value for the `--file` parameter that is not to a `requirements.txt` file. The SBOM generation fails without this parameter. Specify this parameter with the value `pip`.

## Options for scanning using `--unmanaged`

### `--max-depth`

Specify the maximum level of archive extraction.

Usage: `--max-depth=1`

Use `0` (zero, the default) to disable archive extraction completely.

## Options for build tools

### `-- [<CONTEXT-SPECIFIC_OPTIONS>]`

Use a double dash (`--`) after the complete Snyk command to pass additional options (arguments, flags) that follow directly to the build tool, for example Gradle or Maven.

Example: `snyk sbom -- -s settings.xml`

## Examples for the snyk sbom command

### Create a CycloneDX JSON document for a local software project

`$ snyk sbom --format=cyclonedx1.4+json`

### Create a CycloneDX JSON document and redirect stdout to a file

`$ snyk sbom --format=cyclonedx1.4+json > mySBOM.json`

### Create an SPDX JSON document and write it to a file

`$ snyk sbom --format spdx2.3+json --json-file-output mySBOM.json`

### Create an SPDX 2.3 JSON document for an unmanaged software project

`$ snyk sbom --unmanaged --format=spdx2.3+json`

### Create a CycloneDX XML document for a Maven project

`$ snyk sbom --file=pom.xml --format=cyclonedx1.4+xml`

### Create a CycloneDX JSON document for a monorepo

`$ snyk sbom --format=cyclonedx1.4+json --all-projects`

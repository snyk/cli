# snyk(1) -- CLI and build-time tool to find & fix known vulnerabilities in open-source dependencies

## SYNOPSIS

`snyk` \[<COMMAND>] \[<SUBCOMMAND>] \[<OPTIONS>] \[<PACKAGE>] \[-- <COMPILER_OPTIONS>]

## DESCRIPTION

Snyk helps you find, fix and monitor known vulnerabilities in open source dependencies.<br />
For more information see https://snyk.io

### Not sure where to start?

1. authenticate with `$ snyk auth`
2. test your local project with `$ snyk test`
3. get alerted for new vulnerabilities with `$ snyk monitor`

## COMMANDS

To see command-specific flags and usage, see `help` command, e.g. `snyk container --help`.
Available top-level CLI commands:

- `auth` \[<API_TOKEN>\]:
  Authenticate Snyk CLI with a Snyk account.

- `test`:
  Test local project for vulnerabilities.

- `monitor`:
  Snapshot and continuously monitor your project.

- `container`:
  Test container images for vulnerabilities. See `snyk container --help` for full instructions.

- `iac`:
  Find security issues in your Infrastructure as Code files. See `snyk iac --help` for full instructions.

- `code`:
  Find security issues using static code analysis. See `snyk code --help` for full instructions.

- `config`:
  Manage Snyk CLI configuration.

- `protect`:
  Applies the patches specified in your .snyk file to the local file system.

- `policy`:
  Display the .snyk policy for a package.

- `ignore`:
  Modifies the .snyk policy to ignore stated issues.

- `wizard`:
  Configure your policy file to update, auto patch and ignore vulnerabilities. Snyk wizard updates your .snyk file.

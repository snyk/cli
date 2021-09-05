# snyk-code(1) -- Find security issues using Static code analysis scanning

## SYNOPSIS

`snyk` `code` \[<COMMAND>\] \[<OPTIONS>\] <PATH>

## DESCRIPTION

Find security issues using Static code analysis scanning

[For more information see snyk code help page](https://snyk.co/<snyk-code-docs-should-be-here>)

## COMMANDS

- `test`:
  Test for any known issue.

## OPTIONS

- `--severity-threshold`=low|medium|high|critical:
  Only report configuration issues with the provided severity level or higher. Please note that the Snyk Code configuration issues do not currently use the `critical` severity level.

- `--json`:
  Prints results in JSON format.

- `--org`=<ORG_NAME>:
  Specify the <ORG_NAME> to run Snyk commands tied to a specific organization. This will influence private tests limits.
  If you have multiple organizations, you can set a default from the CLI using:

  `$ snyk config set org`=<ORG_NAME>

  Setting a default will ensure all newly tested projects will be tested
  under your default organization. If you need to override the default, you can use the `--org`=<ORG_NAME> argument.
  Default: uses <ORG_NAME> that sets as default in your [Account settings](https://app.snyk.io/account)

- `--sarif`:
  Return results in SARIF format.

# snyk-iac(1) -- Find security issues in your Infrastructure as Code files

## SYNOPSIS

`snyk` `iac` \[<COMMAND>\] \[<OPTIONS>\] <PATH>

## DESCRIPTION

Find security issues in your Infrastructure as Code files.

[For more information see IaC help page](https://snyk.co/ucT6Q)

## COMMANDS

- `test`:
  Test for any known issue.

## OPTIONS

- `--detection-depth`=<DEPTH>:
  (only in `test` command)  
  Indicate the maximum depth of sub-directories to search. <DEPTH> must be a number.

  Default: No Limit  
  Example: `--detection-depth=3`  
  Will limit search to provided directory (or current directory if no <PATH> provided) plus two levels of subdirectories.

- `--severity-threshold`=low|medium|high:
  Only report vulnerabilities of provided level or higher.

- `--json`:
  Prints results in JSON format.

- `--json-file-output`=<OUTPUT_FILE_PATH>:
  (only in `test` command)
  Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.
  This is especially useful if you want to display the human-readable test output via stdout and at the same time save the JSON format output to a file.

- `--org`=<ORG_NAME>:
  Specify the <ORG_NAME> to run Snyk commands tied to a specific organization. This will influence private tests limits.
  If you have multiple organizations, you can set a default from the CLI using:
  
  `$ snyk config set org`=<ORG_NAME>
  
  Setting a default will ensure all newly tested projects will be tested
  under your default organization. If you need to override the default, you can use the `--org`=<ORG_NAME> argument.
  Default: uses <ORG_NAME> that sets as default in your [Account settings](https://app.snyk.io/account)

- `--sarif`:
  Return results in SARIF format.

- `--sarif-file-output`=<OUTPUT_FILE_PATH>:
  (only in `test` command)
  Save test output in SARIF format directly to the <OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.
  This is especially useful if you want to display the human-readable test output via stdout and at the same time save the SARIF format output to a file.

- `--scan=`<TERRAFORM_PLAN_SCAN_MODE>:
  Dedicated flag for Terraform plan scanning modes.  
  It enables to control whether the scan should analyse the full final state (e.g. `planned-values`), or the proposed changes only  (e.g. `resource-changes`).  
  Default: If the `--scan` flag is not provided it would scan the proposed changes only by default.  
  Example #1: `--scan=planned-values` (full state scan)
  Example #2: `--scan=resource-changes` (proposed changes scan)

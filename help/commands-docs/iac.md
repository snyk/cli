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

- `--severity-threshold`=low|medium|high:
  Only report vulnerabilities of provided level or higher.

- `--json`:
  Prints results in JSON format.

- `--json-file-output`=<OUTPUT_FILE_PATH>:
  (only in `test` command)
  Save test output in JSON format directly to the specified file, regardless of whether or not you use the `--json` option.
  This is especially useful if you want to display the human-readable test output via stdout and at the same time save the JSON format output to a file.

- `--sarif`:
  Return results in SARIF format.

- `--sarif-file-output`=<OUTPUT_FILE_PATH>:
  (only in `test` command)
  Save test output in SARIF format directly to the <OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.
  This is especially useful if you want to display the human-readable test output via stdout and at the same time save the SARIF format output to a file.

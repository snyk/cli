# Log4shell

## Usage

`snyk log4shell`

## Description

The `snyk log4shell` command finds traces of the Log4J library that are affected by the Log4Shell vulnerability [CVE-2021-44228](https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720)

The command finds traces of the Log4J library even if it is not declared in the manifest files (such as `pom.xml` or `build.gradle`).

## Managed projects

To test for Log4Shell vulnerabilities in Java projects using their package manager manifest files, use the `snyk test` command. See the [test command help](test.md) (`snyk test --help`) and [Java and Kotlin](https://docs.snyk.io/supported-languages-package-managers-and-frameworks/java-and-kotlin)

To test unmanaged files, use `snyk test --scan-all-unmanaged`

See the Maven options section of the [test command help](test.md); `snyk test --help`

## Exit codes

Possible exit codes and their meaning:

**0**: success (scan completed), Log4Shell not found\
**1**: action_needed (scan completed), Log4Shell found\
**2**: failure, try to re-run the command. Use `-d` to output the debug logs.

## Debug

Use the `-d` option to output the debug logs.

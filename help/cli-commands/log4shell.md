# Log4shell

## Usage

`snyk log4shell`

## Description

The `snyk log4shell` command finds traces of the Log4J library that are affected by the Log4Shell vulnerability [CVE-2021-44228](https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720), even if this library is not declared in the manifest files (such as pom.xml or build.gradle).

## Managed projects

To test for Log4Shell vulnerabilities in Java projects using their package manager manifest files, use the `snyk test` command. See the [test command help](https://docs.snyk.io/features/snyk-cli/commands/test) and [Snyk for Java (Gradle, Maven)](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven).

To test unmanaged files, use `snyk test --scan-all-unmanaged`. See the Maven options section of the [test command help](https://docs.snyk.io/features/snyk-cli/commands/test).

## Exit codes

Possible exit codes and their meaning:

**0**: success, Log4Shell not found\
**1**: action_needed, Log4Shell found\
**2**: failure, try to re-run command

## Debug

Use the `-d` option to output the debug logs.

# snyk log4shell -- Log4shell sniffer

## Usage

`snyk log4shell`

## Description

This command finds traces of the Log4J library that are affected by the Log4Shell vulnerability [CVE-2021-44228](https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720), even if this library is not declared in the manifest files (such as pom.xml or build.gradle).

## Managed projects

To test Java projects using their package manager manifest files, see Snyk for Java (Gradle, Maven).

To learn more about the `snyk test --scan-all-unmanaged`, see the Maven options section of the CLI reference.

## Exit codes

Possible exit codes and their meaning:

**0**: success, Log4Shell not found<br />
**1**: action_needed, Log4Shell found<br />
**2**: failure, try to re-run command<br />

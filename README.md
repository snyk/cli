# Getting started with the Snyk CLI

## Introduction to Snyk and the Snyk CLI

[Snyk](https://snyk.io/) is a developer-first, cloud-native security tool to scan and monitor your software development projects for security vulnerabilities. Snyk scans multiple content types for security issues:

- [**Snyk Open Source**](https://docs.snyk.io/scan-using-snyk/snyk-open-source): Find and automatically fix open-source vulnerabilities
- [**Snyk Code**](https://docs.snyk.io/scan-using-snyk/snyk-code): Find and fix vulnerabilities in your application code in real time
- [**Snyk Container**](https://docs.snyk.io/scan-using-snyk/snyk-container): Find and fix vulnerabilities in container images and Kubernetes applications
- [**Snyk Infrastructure as Code**](https://docs.snyk.io/scan-using-snyk/scan-infrastructure): Find and fix insecure configurations in Terraform and Kubernetes code

[Learn more about what Snyk can do and sign up for a free account](https://snyk.io/).

The **Snyk CLI brings the functionality of Snyk into your development workflow**. You can run the CLI locally from the command line or in an IDE. You can also run the CLI in your CI/CD pipeline. The following shows an example of Snyk CLI test command output.

<figure><img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/snyk-cli-screenshot.png" alt="Snyk CLI test command output example"><figcaption><p>Snyk CLI test command output</p></figcaption></figure>

Snyk CLI scanning **supports many languages and tools.** For detailed information, see the following:

- [Supported languages and frameworks for Open Source and Code](https://docs.snyk.io/getting-started/supported-languages-frameworks-and-feature-availability-overview)
- [Supported operating system distributions for Container](https://docs.snyk.io/scan-with-snyk/snyk-container/how-snyk-container-works/supported-operating-system-distributions)
- [Supported IaC Lanuages and cloud providers](https://docs.snyk.io/scan-with-snyk/snyk-iac/supported-iac-languages-cloud-providers-and-cloud-resources)

This page explains how to install, authenticate, and start scanning using the CLI. Snyk also has an onboarding wizard to guide you through these steps. For a demonstration, view [Starting with Snyk: an overview of the CLI onboarding flow](https://www.youtube.com/watch?v=adj3VF82-v8).

## Install the Snyk CLI and authenticate your machine

To use the CLI, you must install it and authenticate your machine. See [Install or update the Snyk CLI](https://docs.snyk.io/snyk-cli/install-the-snyk-cli) and [Authenticate the CLI with your account](https://docs.snyk.io/snyk-cli/authenticate-the-cli-with-your-account). You can refer to the [release notes](https://github.com/snyk/cli/releases) for a summary of changes in each release. Before scanning your code, review the [Code execution warning for Snyk CLI](https://docs.snyk.io/snyk-cli/code-execution-warning-for-snyk-cli).

**Note:** Before you can use the CLI for Open Source scanning, you must install your package manager. The needed third-party tools, such as Gradle or Maven, must be in the `PATH`.

You can use the CLI in your IDE or CI/CD environment. For details, see [Install as part of a Snyk integration](https://docs.snyk.io/snyk-cli/install-the-snyk-cli#install-as-a-part-of-a-snyk-integration).

## Test your installation

After authenticating, you can **test your installation**. For a quick test, run `snyk --help`.

Alternatively, you can perform a **quick test** on a public npm package, for example `snyk test ionic`.

Look at the `test` command **report** in your terminal. The report shows the vulnerabilities Snyk found in the package. For each issue found, Snyk reports the severity of the issue, provides a link to a detailed description, reports the path through which the vulnerable module got into your system, and provides guidance on how to fix the problem.

## Scan your development Project

**Note:** Before using the Snyk CLI to test your Open Source Project for vulnerabilities, with limited exceptions, you must **build your Project**. For details, see [Open Source Projects that must be built before testing](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-open-source/open-source-projects-that-must-be-built-before-testing-with-the-snyk-cli).

In addition, depending on the language of your open-source Project, you may need to **set up your language environment** before using the Snyk CLI. For details, refer to [Supported languages, frameworks, and feature availability overview.](https://docs.snyk.io/scan-using-snyk/supported-languages-and-frameworks/supported-languages-frameworks-and-feature-availability-overview)

After you have installed the CLI and authenticated your machine, to **scan an open-source Project**, use `cd /my/project/` to change the current directory to`a`folder containing a supported package manifest file, such as `package.json`, `pom.xml`, or `composer.lock`. Then run `snyk test`. All vulnerabilities identified are listed, including their path and fix guidance.

To scan your **source code** run `snyk code test`.

You can **scan a Docker image** by its tag running, for example: `snyk container test ubuntu:18.04`.

To scan a **Kubernetes (K8s) file** run the following:\
`snyk iac test /path/to/kubernetes_file.yaml`

For details about using the Snyk CLI to scan each content type, see the following:

- [Snyk CLI for Snyk Open Source](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-open-source) and the CLI help for the [`test`](https://docs.snyk.io/snyk-cli/commands/test) and [`monitor`](https://docs.snyk.io/snyk-cli/commands/monitor) commands
- [Snyk CLI for Snyk Code](https://docs.snyk.io/snyk-cli/commands/code) and the [Snyk Code CLI help](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-snyk-code)
- [Snyk CLI for Snyk Container](https://docs.snyk.io/snyk-cli/commands/container), including Docker scanning, and the [Snyk Container CLI help](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-snyk-container)
- [Snyk CLI for Snyk IaC](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-iac), including Terraform and Kubernetes (K8s) Projects, and the [Snyk IAC CLI help](https://docs.snyk.io/snyk-cli/commands/iac)

## Monitor your Open Source or Container Project

Snyk can monitor your Open Source or Container integrated SCM Project periodically and alert you to new vulnerabilities. To set up your Project to be monitored, run `snyk monitor` or `snyk container monitor`.

This creates a snapshot of your current dependencies so Snyk can regularly scan your code. Snyk can then alert you about newly disclosed vulnerabilities as they are introduced or when a previously unavailable patch or upgrade path is created. The following code shows an example of the output of the `snyk monitor` command.

```
> snyk monitor
Monitoring /project (project-name)...

Explore this snapshot at
https://app.snyk.io/org/my-org/project/29361c2c-9005-4692
-8df4-88f1c040fa7c/history/e1c994b3-de5d-482b-9281-eab4236c851e

Notifications about newly disclosed issues related to these
dependencies will be emailed to you.
```

You can log in to your Snyk account and navigate to the [Projects page](https://app.snyk.io/projects) to find the latest snapshot and scan results:

<figure><img src="https://github.com/snyk/user-docs/raw/HEAD/docs/.gitbook/assets/monitor (1).png" alt="Snyk monitor snapshot and scan results"><figcaption><p>Snyk monitor snapshot and scan results</p></figcaption></figure>

For more information, see [Monitor your Projects at regular intervals](https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/monitor-your-projects-at-regular-intervals).

## Running out of tests

Snyk allows unlimited tests for public repositories. If you are on the Free plan, you have a limited number of tests per month. Paid plans have unlimited tests on private and public repositories. If you are on the Free plan and notice that your test count is quickly being used, even with public repositories, you can remedy this by telling Snyk the public url of the repository that is being scanned by the Snyk CLI. This ensures that Snyk does not count a public repository towards the test limits.

If you run out of tests on an open-source Project, follow these steps:

- Run `snyk monitor`.
- Open the Snyk UI and navigate to the **settings** of the Project.
- Enter the URL of your open-source repository in **Git remote URL**.

## Additional information about the Snyk CLI

Run `snyk help` or see the [CLI commands and options summary](https://docs.snyk.io/snyk-cli/cli-commands-and-options-summary).

See the course [Introduction to the Snyk CLI](https://learn.snyk.io/lesson/snyk-cli/https://learn.snyk.io/lesson/snyk-cli/) for a quick video training session.

Snyk also provides a [cheat sheet](https://res.cloudinary.com/snyk/image/upload/v1664236143/cheat-sheets/cheat-sheet-snyk-cli-v3.pdf) ([blog post](https://snyk.io/blog/snyk-cli-cheat-sheet/)) and a [video tutorial](https://www.youtube.com/watch?v=xp_LtchEkT8).

In particular, see the information about the following options that you may find useful:

- `--severity-threshold=low|medium|high|critical`: Report only vulnerabilities of the specified level or higher.
- `--json`: Print results in JSON format.
- `--all-projects`: Auto-detect all Projects in the working directory.

For detailed information about the CLI, see the [CLI docs](https://docs.snyk.io/snyk-cli).

## Getting support for the Snyk CLI

[Submit a ticket](https://support.snyk.io/hc/en-us/requests/new) to Snyk support whenever you need help with the Snyk CLI or Snyk in general. Note that Snyk support does not actively monitor GitHub Issues on any [Snyk development project](https://github.com/snyk).

## Contributing to the Snyk CLI

The Snyk CLI project is open-source, but Snyk does not encourage outside contributors.

You may look into [design decisions for the Snyk CLI](https://github.com/snyk/snyk/blob/master/help/_about-this-project/README.md).

The Snyk CLI repository is a monorepo that also covers other projects and tools, such as [@snyk/protect](https://github.com/snyk/snyk/tree/master/packages/snyk-protect), also available at [npm package for snyk-protect command](https://www.npmjs.com/package/@snyk/protect).

## Security

For any security issues or concerns, see the [SECURITY.md](https://github.com/snyk/snyk/blob/master/SECURITY.md) file in the GitHub repository.

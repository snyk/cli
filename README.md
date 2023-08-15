<p align="center">
  <img src="https://snyk.io/style/asset/logo/snyk-print.svg" />
</p>

# Getting started with the CLI

## Introduction to Snyk and the Snyk CLI


[Snyk](https://snyk.io) is a developer-first, cloud-native security tool to scan and monitor your software development projects for security vulnerabilities. Snyk scans multiple content types for security issues:


- [**Snyk Open Source**](https://snyk.io/product/open-source-security-management/): Find and automatically fix open source vulnerabilities
- [**Snyk Code**](https://snyk.io/product/snyk-code/): Find and fix vulnerabilities in your application code in real time
- [**Snyk Container**](https://snyk.io/product/container-vulnerability-management/): Find and fix vulnerabilities in container images and Kubernetes applications
- [**Snyk Infrastructure as Code**](https://snyk.io/product/infrastructure-as-code-security/): Find and fix insecure configurations in Terraform and Kubernetes code

[Learn more about what Snyk can do and sign up for a free account »](https://snyk.io)

The **Snyk CLI brings the functionality of Snyk into your development workflow**. You can run the CLI locally or in your CI/CD pipeline. The following shows an example of Snyk CLI test command output.

![Snyk CLI screenshot](help/snyk-cli-screenshot.png)

Snyk CLI scanning supports many languages and tools. For detailed information, see the summary of supported environments. For details about how Snyk scans each content type, see the following:

- Snyk Open Source scanning
- Snyk Code scanning
- Snyk Container scanning
- Snyk Infrastructure as Code scanning, including Terraform and Kubernetes (K8s) Projects

This page explains how to install, authenticate, and start scanning using the CLI. Snyk also has an onboarding wizard to guide you through these steps. For a demonstration, view Starting with Snyk: an overview of the CLI onboarding flow.

## Install the Snyk CLI and authenticate your machine

To use the CLI, you must install it and authenticate your machine. See Install or update the Snyk CLI and the Auth command help. You can refer to the release notes for a summary of changes in each release. Before scanning your codem review the Code execution warning for Snyk CLI.

**Note**: Before you can use the CLI for Open Source scanning, you must install your package manager. The needed third-party tools, such as Gradle or Maven, must be in the PATH.

You can use the CLI in your IDE or CI/CD environment. For details, see Install as part of a Snyk integration.

You can authorize Snyk CLI in your CI/CD programmatically:
- Using a SNYK_TOKEN envvar (preferred)
```bash
SNYK_TOKEN=<SNYK_API_TOKEN> snyk test
```
- Or using a Snyk auth command
```bash
snyk auth <SNYK_API_TOKEN>
snyk test
```
## Test your installation

After authenticating, you can test your installation. For a quick test, run
```bash
snyk --help
```
Alternatively, you can perform a quick test on a public npm package, for example
```bash
snyk test ionic
```
Look at the `test` command **report** in your terminal. The report shows the vulnerabilities Snyk found in the package. For each issue found, Snyk reports the severity of the issue, provides a link to a detailed description, reports the path through which the vulnerable module got into your system, and provides guidance on how to fix the problem.

## Scan your development Project

**Note**: Before using the Snyk CLI to test your Open Source Project for vulnerabilities, with limited exceptions, you must build your Project. For details, see Which Projects must be built before testing with CLI?

In addition, depending on the language of your open-source Project, you may need to **set up your language environment** before using the Snyk CLI. For details, refer to Open Source language and package manager support.

After you have installed the CLI and authenticated your machine, to **scan an open-source Project**, use `cd /my/project/` to change the current directory to a folder containing a supported package manifest file, such as `package.json`, `pom.xml`, or `composer.lock`. Then run `snyk test`. All vulnerabilities identified are listed, including their path and fix guidance.

To scan your source code run `snyk code test`.

You can scan a Docker image by its tag using Snyk Container by running, for example: `snyk container test ubuntu:18.04`.

To scan a Kubernetes (K8s) file run the following:
`snyk iac test /path/to/kubernetes_file.yaml`

For details about how Snyk scans each content type, see the following:

- Snyk Open Source scanning
- Snyk Code scanning
- Snyk Container scanning
- Snyk Infrastructure as Code scanning, including Terraform and Kubernetes (K8s) Projects

## Monitor your Open Source or Container Project

Snyk can monitor your Project periodically and alert you to new vulnerabilities. To set up your Project to be monitored, run `snyk monitor` or `snyk container monitor`.

This creates a snapshot of your current dependencies so Snyk can regularly scan your code. Snyk can then alert you about newly disclosed vulnerabilities as they are introduced or when a previously unavailable patch or upgrade path is created. The following code shows an example of the output of the `snyk monitor` command.

```bash
> snyk monitor
Monitoring /project (project-name)...

Explore this snapshot at 
https://app.snyk.io/org/my-org/project/29361c2c-9005-4692
-8df4-88f1c040fa7c/history/e1c994b3-de5d-482b-9281-eab4236c851e

Notifications about newly disclosed issues related to these 
dependencies will be emailed to you.
```

You can log in to the Snyk Web UI and navigate to the Projects page to find the latest snapshot and scan results:

<p align="center">
  <a href="https://snyk.io">
    <img src="help/monitor.svg" alt="Snyk CLI monitor projects" width="70%" />
  </a>
</p>

For more information, see Monitor your Projects at regular intervals.

## Running out of tests

If you run out of tests on an open-source Project, follow these steps:
- Run `snyk monitor`.
- Open the Snyk UI and navigate to the **settings** of the Project.
- Enter the URL of your open-source repository in **Git remote URL**.

## Additional information about the Snyk CLI
Run `snyk help` or see the CLI commands and options summary.
See the course Introduction to the Snyk CLI for a quick video training session.
Snyk also provides a cheat (blog post) and a video tutorial.
In particular, see the information about the following options that you may find useful:
- `--severity-threshold=low|medium|high|critical`: Report only vulnerabilities of the specified level or higher
- `--json`: Print results in JSON format
- `--all-projects`: Auto-detect all Projects in the working directory

For detailed information about the CLI, see the CLI docs. For information about scanning for each content type, see the following pages:

- Use Snyk Open Source from the CLI
- Using Snyk Code from the CLI
- Snyk CLI for container security
- Snyk CLI for Infrastructure as Code

## Getting support for the Snyk CLI
Submit a ticket to Snyk support whenever you need help with the Snyk CLI or Snyk in general. Note that Snyk support does not actively monitor GitHub Issues on any Snyk project.

## Contributing to the Snyk CLI
The Snyk CLI project is open-source, but Snyk does not encourage outside contributors.
You may look into design decisions for the Snyk CLI
The Snyk CLI repository is a monorepo that also covers other projects and tools, such as @snyk/protect, also available at npm package for snyk-protect command.

## Security



# What is Snyk CLI?

Snyk CLI brings the functionality of [Snyk](https://snyk.io) into your development workflow. It can be run locally or in your CI/CD pipeline to scan your projects for security issues.

## Supported languages and tools

Snyk supports many languages and tools, including Java, .NET, JavaScript, Python, Golang, PHP, C/C++, Ruby, Scala and more. See our [Language Support documentation](https://support.snyk.io/hc/en-us/articles/360020352437-Language-support-summary).

CLI also supports [Docker scanning](https://support.snyk.io/hc/en-us/articles/360003946897-Snyk-Container-security-overview) and [Terraform, k8s and other Infrastructure as Code files scanning](https://support.snyk.io/hc/en-us/categories/360001342678-Infrastructure-as-code).

---

# Install Snyk CLI

Snyk CLI can be installed through multiple channels.

## Install with npm or Yarn

[Snyk CLI is available as an npm package](https://www.npmjs.com/package/snyk). If you have Node.js installed locally, you can install it by running:

```bash
npm install snyk@latest -g
```

or if you are using Yarn:

```bash
yarn global add snyk
```

## More installation methods

<details>
  <summary>Standalone executables (macOS, Linux, Windows)</summary>

### Standalone executables

Use [GitHub Releases](https://github.com/snyk/snyk/releases) to download a standalone executable of Snyk CLI for your platform.

We also provide these standalone executables on our official CDN. See [the `release.json` file](https://static.snyk.io/cli/latest/release.json) for the download links:

```text
https://static.snyk.io/cli/latest/release.json

# Or for specific version or platform
https://static.snyk.io/cli/v1.666.0/release.json
https://static.snyk.io/cli/latest/snyk-macos
```

For example, to download and run the latest Snyk CLI on macOS, you could run:

```bash
curl https://static.snyk.io/cli/latest/snyk-macos -o snyk
chmod +x ./snyk
mv ./snyk /usr/local/bin/
```

You can also use these direct links to download the executables:

- macOS: https://static.snyk.io/cli/latest/snyk-macos
- Windows: https://static.snyk.io/cli/latest/snyk-win.exe
- Linux: https://static.snyk.io/cli/latest/snyk-linux
- Linux (arm64): https://static.snyk.io/cli/latest/snyk-linux-arm64
- Alpine: https://static.snyk.io/cli/latest/snyk-alpine

Drawback of this method is, that you will have to manually keep the Snyk CLI up to date.

#### Verifying standalone binaries

You can verify both shasum of downloaded binaries and their GPG signatures.

Download location on `static.snyk.io` contains a file called `sha256sums.txt.asc`.
You can download it directly `https://static.snyk.io/cli/latest/sha256sums.txt.asc` or for a specific version like `https://static.snyk.io/cli/v1.666.0/sha256sums.txt.asc`.

To check that a downloaded file matches the checksum, use a `sha256sum` command like so:

```bash
grep snyk-macos sha256sums.txt.asc | sha256sum -c -
```

If you want to verify Snyk CLI standalone binaries against [Snyk CLI GPG key](help/_about-this-project/snyk-code-signing-public.pgp), you will need to import it first:

```bash
# A22665FB96CAB0E0973604C83676C4B8289C296E is the key belonging to code-signing@snyk.io
# Copy of this public key is also in this repository /help/_about-this-project/snyk-code-signing-public.pgp
gpg --keyserver hkps://keys.openpgp.org --recv-keys A22665FB96CAB0E0973604C83676C4B8289C296E
```

Then verify the file is signed with:

```bash
gpg --verify sha256sums.txt.asc
```

Command output should look like:

```plain
gpg: Signature made So  8 Jan 14:11:44 2023 CET
gpg:                using EDDSA key A22665FB96CAB0E0973604C83676C4B8289C296E
gpg: Good signature from "Snyk Limited <code-signing@snyk.io>" [unknown]
gpg: WARNING: This key is not certified with a trusted signature!
gpg:          There is no indication that the signature belongs to the owner.
Primary key fingerprint: A226 65FB 96CA B0E0 9736  04C8 3676 C4B8 289C 296E
```

</details>

<details>
  <summary>Install with Homebrew (macOS, Linux)</summary>

### Homebrew

Install Snyk CLI from [Snyk tap](https://github.com/snyk/homebrew-tap) with [Homebrew](https://brew.sh) by running:

```bash
brew tap snyk/tap
brew install snyk
```

</details>

<details>
  <summary>Scoop (Windows)</summary>

### Scoop

Install Snyk CLI from our [Snyk bucket](https://github.com/snyk/scoop-snyk) with [Scoop](https://scoop.sh) on Windows:

```
scoop bucket add snyk https://github.com/snyk/scoop-snyk
scoop install snyk
```

</details>

<details>
  <summary>Snyk CLI in a Docker image</summary>

### Snyk CLI in a Docker image

Snyk CLI can also be run from a Docker image. Snyk offers multiple Docker tags under [`snyk/snyk`](https://hub.docker.com/r/snyk/snyk). These images wrap the Snyk CLI and depending on the Tag come with a relevant tooling for different projects. [See the snyk/images on GitHub for more details and examples](https://github.com/snyk/snyk-images).

</details>

## Install as a part of a Snyk CLI integration

Snyk also offers many integrations into developer tooling. These integrations will install and manage the Snyk CLI for you. For example:

- [Snyk Jenkins plugin](https://github.com/jenkinsci/snyk-security-scanner-plugin)
- [CircleCI Orb](https://github.com/snyk/snyk-orb)
- [Azure Pipelines Task](https://github.com/snyk/snyk-azure-pipelines-task)
- [GitHub Actions](https://github.com/snyk/actions)
- [IntelliJ IDE Plugin](https://github.com/snyk/snyk-intellij-plugin)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=snyk-security.snyk-vulnerability-scanner)
- [Eclipse IDE Extension](https://github.com/snyk/snyk-eclipse-plugin)
- [Maven plugin](https://github.com/snyk/snyk-maven-plugin)
- And many more. See [the Integrations documentation](https://support.snyk.io/hc/en-us/categories/360000598398-Integrations)

<p align="center">
  <a href="https://support.snyk.io/hc/en-us/categories/360000598398-Integrations">
    <img src="help/ide.svg" alt="Snyk CLI IDE integration" width="50%" />
  </a>
</p>

---

# Getting started with Snyk CLI

Once you installed the Snyk CLI, you can verify it's working by running:

```bash
snyk --help
```

See the [full Snyk CLI help](./help/cli-commands).

## Authenticating Snyk CLI

Snyk CLI depends on [Snyk.io](https://snyk.io) APIs. Connect your Snyk CLI with [Snyk.io](https://snyk.io) by running:

```bash
snyk auth
```

## Setting up language support

Depending on your project's language, you might need to setup your language environment before using Snyk.

See our [Language Support documentation](https://support.snyk.io/hc/en-us/articles/360020352437-Language-support-summary).

## Scanning your project

If you are already in a folder with a supported project, start by running:

```bash
snyk test
```

Or scan a Docker image by its tag with [Snyk Container](https://snyk.io/product/container-vulnerability-management/):

```bash
snyk container test ubuntu:18.04
```

Or a k8s file:

```bash
snyk iac test /path/to/kubernetes_file.yaml
```

## Monitoring your project

Snyk can also monitor your project periodically and alert you for new vulnerabilities. The `snyk monitor` is similar to `snyk test` and can be used to create a project on the Snyk website that will be continuously monitored for new vulnerabilities.

<p align="center">
  <a href="https://snyk.io">
    <img src="help/monitor.svg" alt="Snyk CLI monitor projects" width="70%" />
  </a>
</p>

```
> snyk monitor
Monitoring /project (project-name)...

Explore this snapshot at https://app.snyk.io/org/my-org/project/29361c2c-9005-4692-8df4-88f1c040fa7c/history/e1c994b3-de5d-482b-9281-eab4236c851e

Notifications about newly disclosed issues related to these dependencies will be emailed to you.
```

### Add Snyk to your CI/CD

Snyk is really powerful when you are continuously scanning and monitoring your projects for vulnerabilities.

Use one of [our integrations](#install-as-a-part-of-a-snyk-cli-integration) to stay secure.

You can authorize Snyk CLI in your CI/CD programatically:

```bash
# Using a SNYK_TOKEN envvar (preferred)
SNYK_TOKEN=<SNYK_API_TOKEN> snyk test

# Or using a Snyk auth command
snyk auth <SNYK_API_TOKEN>
snyk test
```

## More flags and options to try

Here are some flags that you might find useful:

- `--severity-threshold=low|medium|high|critical`

  Only report vulnerabilities of provided level or higher.

- `--json`

  Prints results in JSON format.

- `--all-projects`

  Auto-detect all projects in working directory

[See all the available commands and options](./help/cli-commands) by running `--help`:

```bash
snyk --help
# or get help for a specific command like
snyk iac --help
snyk code --help
```

# Getting support

If you need support using Snyk CLI, please [contact support](https://support.snyk.io).

We do not actively monitor GitHub Issues so any issues there may go unnoticed.

# Contributing

If you are an external contributor, before working on any contributions, please first [contact support](https://support.snyk.io) to discuss the issue or feature request with us.

If you are contributing to Snyk CLI, see [our contributing guidelines](CONTRIBUTING.md)

For information on how Snyk CLI is implemented, see [our design decisions](help/_about-this-project/README.md).

This repository is a monorepo, also covering other projects and tools:

- [`@snyk/fix`](packages/snyk-fix): npm package for `snyk fix` libraries.
- [`@snyk/protect`](packages/snyk-protect): npm package for [`snyk-protect`](https://www.npmjs.com/package/@snyk/protect) command.

# Security

For any security issues or concerns, please see [SECURITY.md](SECURITY.md) file in this repository.

# Notices

## Snyk API usage policy

The use of Snyk's API, whether through the use of the 'snyk' npm package or otherwise, is subject to the [Terms & Conditions](https://snyk.co/ucT6N).

---

Made with 💜 by Snyk

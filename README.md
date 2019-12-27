<p align="center">
  <img src="https://snyk.io/style/asset/logo/snyk-print.svg" />
</p>

<p align="center">
  <a href="https://snyk.io/docs/?utm_campaign=docs&utm_medium=github&utm_source=full_docs">Documentation</a> |
  <a href="https://snyk.io/test/">Test your project</a>
</p>

<p align="center">
  Snyk helps you find, fix and monitor known vulnerabilities in open source
</p>

<p align="center">
  <a href="https://snyk.io/test/github/snyk/snyk"><img src="https://snyk.io/test/github/snyk/snyk/badge.svg" alt="Known Vulnerabilities"/></a>
  <a href="https://snyk.io/features/"><img src="https://badgen.net/npm/dm/snyk" alt="Monthly Downloads"/></a>
</p>

---

## What is Snyk?

<p align="center">
  <a href="https://youtu.be/4ng5usM6fd8">
    <img alt="What is Snyk?" src="https://i3.ytimg.com/vi/4ng5usM6fd8/maxresdefault.jpg" width="75%" height="75%" />
  </a>
</p>

## Table Of Contents:

- [Installation](#installation)
- [CLI](#cli)
- [Features](#features)
- [Docker](#docker)
- [Badge](#badge)

## Installation

1. Install the Snyk utility using `npm install -g snyk`.
2. Once installed you will need to authenticate with your Snyk account: `snyk auth`

For more detail on how to authenticate take a look at the [CLI authentication](https://snyk.io/docs/using-snyk#authentication?utm_campaign=docs&utm_medium=github&utm_source=CLI_authentication) section of the Snyk documentation.

## CLI

```console
snyk [options] [command] [package]
```

Run `snyk --help` to get a quick overview of all commands or for full details on the CLI read the snyk.io [CLI docs](https://snyk.io/docs/using-snyk?utm_campaign=docs&utm_medium=github&utm_source=cli).

The package argument is optional. If no package is given, Snyk will run the command against the current working directory allowing you test you non-public applications.

## Features

- **Find** known vulnerabilities by running `snyk test` on a project either as a one off or as part of your CI process.
- **Fix** vulnerabilities using `snyk wizard` and `snyk protect`.
  - `snyk wizard` walks you through finding and fixing known vulnerabilities in your project. Remediation options include configuring your policy file to update, auto patch and ignore vulnerabilities. (npm only)
  - `snyk protect` your code from vulnerabilities by applying patches and optionally suppressing specific vulnerabilities.
- **Alert** `snyk monitor` records the state of dependencies and any vulnerabilities on snyk.io so you can be alerted when new vulnerabilities or updates/patches are disclosed that affect your repositories.
- **Prevent** new vulnerable dependencies from being added to your project by running `snyk test` as part of your CI to fail tests when vulnerable Node.js or Ruby dependencies are added.

## Snyk cli Docker images

[See all snyk/snyk-cli images](https://hub.docker.com/r/snyk/snyk-cli)

Snyk is also provided as a set of Docker images that carry the runtime environment of each package manager. For example, the npm image will carry all of the needed setup to run `npm install` on the currently running container. Currently there are images for npm, Ruby, Maven, Gradle and SBT.

The images can perform `snyk test` by default on the specified project which is mounted to the container as a read/write volume, and `snyk monitor` if the `MONITOR` environment variable is set when running the docker container. If you want an HTML report for `test` command, make sure `--json` parameter is provided. `monitor` command appends it automatically. An HTML file called `snyk_report.html` and a CSS file called `snyk_report.css` will be generated. The image also writes a file called `snyk-res.json` for internal use and `snyk-error.log` for errors that we can look at if something goes wrong.

The following environment variables can be used when running the container on docker:

- `SNYK_TOKEN` - Snyk API token, obtained from [https://app.snyk.io/account](https://app.snyk.io/account).
- `USER_ID` - [OPTIONAL] Current user ID on the host machine. If not provided will take the user ID of the currently running user inside the container. This is used for CI builds such as Jenkins where we are running with a non-privileged user and want to allow the user to access the mounted project folder.
- `MONITOR` - [OPTIONAL] If set, will generate an html report via `snyk-to-html` and runs `snyk monitor` after running `snyk test`.
- `PROJECT_FOLDER` - [OPTIONAL] If set, this will cd to the directory inside the mounted project dir to run snyk inside it.
- `ENV_FLAGS` - [OPTIONAL] additional environment parameters to pass to `snyk test` when running the container.
- `TARGET_FILE` - [OPTIONAL] additional environment parameters to pass to `snyk test` & `snyk monitor` equal to `--file` option in the cli.


Docker images are tagged according to the package manager runtime they include, the package manager version and snyk version.
The general format of tags is [snyk-version]-[package-manager]-[package-manager-version] or just [package-manager]-[package-manager-version] if we want to use the latest version of snyk. Please see available tags to see the available options.

[snyk-version] - The version of snyk that is installed in the image, if version is omitted it will use the latest version.
[package-manager] - One of the available package managers (e.g: npm, mvn, gradle, etc...).
[package-manager-version] - The version of the package manager that is installed inside the image.


**Note** We will need to mount the project root folder when running the image so that Snyk can access the code within the container. The host project folder will be mounted to `/project` on the container and will be used to read the dependencies file and write results for CI builds.

#### Below are examples of running `snyk test` and `snyk monitor` in the image (with the latest version of Snyk):

- `snyk test`
  ```
  docker run -it
      -e "SNYK_TOKEN=<TOKEN>"
      -e "USER_ID=1234"
      -v "<PROJECT_DIRECTORY>:/project"
    snyk/snyk-cli:npm
  ```

- `snyk test` with a report generated via `snyk-to-html`
  ```
  docker run -it
      -e "SNYK_TOKEN=<TOKEN>"
      -e "USER_ID=1234"
      -e "MONITOR=true"
      -v "<PROJECT_DIRECTORY>:/project"
    snyk/snyk-cli:npm test --json --org=my-org-name
  ```

- `snyk monitor`
  ```
  docker run -it
      -e "SNYK_TOKEN=<TOKEN>"
      -e "USER_ID=1234"
      -v "<PROJECT_DIRECTORY>:/project"
    snyk/snyk-cli:npm monitor
  ```

### Node.js (npm)

`snyk/snyk-cli:npm` - [see all available `npm` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=npm)

### RubyGems

`snyk/snyk-cli:rubygems` - [see all available `rubygems` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=rubygems)

### Maven 3.5.4 / 3.6.3 / 3.6.3 (Java 11)

`snyk/snyk-cli:maven-*` - [see all available `maven` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=maven)

You may also need to mount the local .m2 and .ivy2 folders, example:

```
docker run -it
    -e "SNYK_TOKEN=<TOKEN>"
    -e "USER_ID=1234"
    -e "MONITOR=true"
    -v "<PROJECT_DIRECTORY>:/project"
    -v "/home/user/.m2:/home/node/.m2"
    -v "/home/user/.ivy2:/home/node/.ivy2"
  snyk/snyk-cli:maven-3.5.4 test --org=my-org-name
```

### Python 2 / 3
`snyk/snyk-cli:python-*` - [see all available `python` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=python)


- setup.py (example in the current directory with Python 3)
```
  docker run -it
    -e "SNYK_TOKEN=<TOKEN>"
    -e "TARGET_FILE=setup.py"
    -v "$PWD:/project"
    snyk/snyk-cli:python-3
```

- \*req\*.txt (requirements-dev.txt / prod-reqs.txt etc)

```
docker run -it -e
  docker run -it
    -e "SNYK_TOKEN=<TOKEN>"
    -e "TARGET_FILE=requirements-dev.txt"
    -v "$PWD:/project"
    snyk/snyk-cli:python-3 test --package-manager=pip
```


### SBT 0.13.16 / SBT 1.0.4
`snyk/snyk-cli:sbt-*` - [see all available `sbt` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=sbt)


You may also need to mount the local .m2 and .ivy2 folders, example:

*Note*: the `dependency-tree` or `sbt-dependency-graph` or `sbt-coursier` (included by default in latest sbt versions) module is required for `snyk` to process Scala projects.

For `dependency-tree` you can use [version 0.8.2](https://github.com/jrudolph/sbt-dependency-graph/tree/v0.8.2) for SBT 0.13.16 and [version 0.9.0](https://github.com/jrudolph/sbt-dependency-graph/tree/v0.9.0) for version SBT 1.0.4.


### Gradle 2.8 / Gradle 4.4 / Gradle 5.4
`snyk/snyk-cli:gradle-*` - [see all available `gradle` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=gradle)

You may also need to mount the local .m2 and .ivy2 folders, example:


### Docker

`snyk/snyk-cli:docker` - [see all available `docker` tagged images](https://hub.docker.com/r/snyk/snyk-cli/tags?page=1&name=docker)

```
docker run -it
    -e "SNYK_TOKEN=<TOKEN>"
    -e "USER_ID=1234"
    -e "MONITOR=true"
    -v "<PROJECT_DIRECTORY>:/project"
    -v "/var/run/docker.sock:/var/run/docker.sock"
  snyk/snyk-cli:docker test --docker <APP>:<TAG> --file=<DOCKERFILE>
```

## Badge

Make users feel more confident in using your website by adding your Snyk badge!

<a href="https://snyk.io/test/github/snyk/snyk"><img src="https://snyk.io/test/github/snyk/snyk/badge.svg" alt="Known Vulnerabilities"/></a>

```
[![Known Vulnerabilities](https://snyk.io/package/npm/snyk/badge.svg)](https://snyk.io/package/npm/snyk)
```

[![Analytics](https://ga-beacon.appspot.com/UA-69111857-2/Snyk/snyk?pixel)](https://snyk.io/)

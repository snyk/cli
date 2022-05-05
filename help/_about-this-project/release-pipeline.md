# Snyk CLI release pipeline

This document is describing Snyk CLI release pipeline. If you are looking for guidelines on how to release the Snyk CLI, see [CONTRIBUTING.md](../../CONTRIBUTING.md).

This is a rough outline of the Snyk CLI release pipeline. For an up to date steps of the CircleCI builds see [CircleCI config file](../../.circleci/config.yml).

```mermaid
flowchart TB
    subgraph GitHub
        direction LR
        developer--Pushes code-->repo
    end

    GitHub--Sends webhook and triggers build-->CircleCI

    subgraph CircleCI
        direction LR

        circle{Triggers build}

        circle-->executor(CircleCI Executor)
        executor--runs-->Docker(Circle's Docker images cimg)
        Docker--contains packages from---aptregistry(apt Registry)
        Docker--Runs tests-->Tests
        Tests---cliartifacts(Snyk CLI Artifacts like binaries, packages...)---signing(Checksums, signing and packaging)---publish{Publish artifacts}
    end

    Docker--Pulls---dependencies

    subgraph registries [Public Registries]
        dependencies--apt install---apt
        apt--Installs---pip
        dependencies--npm install using package-lock---npm
        dependencies--curl---nodejsorg
        dependencies--sdkman CLI---sdkman
        dependencies--curl/bash---shellspec
        dependencies--choco CLI---chocolatey
        dependencies--Orb---awscli
        dependencies--Orb---ghcli
        Tests--running Snyk tests pulls from---mavencentral
        Tests--running Snyk tests pulls from---npm
    end

    publish---releases

    subgraph releases [Releases]
      direction TB
      artifacts---cdn & npmsnykpackage(Snyk npm packages) & githubReleases

      cdn--Serves CLI Artifacts---dockerhub(DockerHub)
      cdn--Serves CLI Artifacts---homebrew(Homebrew)
      cdn--Serves CLI Artifacts---scoop(Scoop)
      cdn--Serves CLI Artifacts---integrations(Snyk integrations)
    end

    githubReleases(GitHub Releases)
    repo(snyk/cli repository)
    npm(public npm repository)
    apt(apt Registry)
    nodejsorg(Node.js website)
    mavencentral(Maven central)
    sdkman(SDKMAN)
    shellspec(Shellspec git repository)
    awscli(AWS CLI)
    ghcli(GitHub CLI)
    chocolatey(Chocolatey)
    pip(pip)
    cdn(Snyk CDN)
```

## Notes

### How often are

Snyk CLI versions on CDN, GitHub Release and on npm are updated almost instantly.

Integrations like Homebrew, Scoop or Docker images are usually released less often. Once a day for Homebrew and Scoop and once a week for Docker images.

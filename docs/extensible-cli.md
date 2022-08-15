# Extensible CLI

**This is an early preview.**

**None of this is available in the Snyk CLI, until the Extensible CLI GA milestone is met. Planned things outlined in this public document could change.**

Extensible CLI is an architectural vision for evolutionary improvements to the Snyk CLI. Major component of this work is an introduction of **Snyk CLI Extensions**. There are multiple areas we expect a dramatic improvements:

## Improved CLI UX
We are designing Extensible CLI to allow us enforce governance on commands’ options, behaviors and output. We can achieve this by defining Snyk CLI UX Guidelines and provide the baseline implementation of the guidelines through Snyk CLI SDK, that’s used to build CLI Extensions.

Over time, this should raise all Snyk products in CLI to the same level. And in future, together with Snyk REST API, opens up a door for better interoperability between Snyk products and 3rd party integrations.

Since we also got an opportunity to refactor or redesign multiple core features, Extensible CLI work also provides numerous quality-of-life improvements - like improved network connectivity, extended and more predictable option flags parsing, shell autocompletion and more.

## Opening up an ecosystem of CLI commands and functionality
Following Snyk’s shift-left approach, we aim to open up Snyk CLI ecosystem to commands and integrations written in multiple languages to reflect various ecosystem needs. This capability also allows Snyk to roll out new products and functionality faster.

Long term goal is opening up the Snyk CLI ecosystem to our partners and open source developers.

## Better security posture
Snyk is committed to deliver great security posture for the Snyk CLI. Work on the Extensible CLI allows us to redesign the build system and its affordances, improving our security posture and opening new avenues for improving runtime and Supply Chain security.

## Golang wrapper and Extensions system
First part of this work is to make the Extensible CLI Core written in Golang available in the main Snyk CLI channel. This Core then wraps and enriches functionality of the current Snyk CLI v1 in a backwards-compatible manner. This objective is tracked in the Extensible CLI GA milestone.

We are also making available a preview of the Extension lifecycle. This preview shows a basic CLI Extension being integrated as a new command into the current Snyk CLI.

## Extensions
See the [Snyk CLI Extensions](./cli-extensions.md) documentation.

[![Snyk CLI Extensions diagram](snyk-cli-extensions-diagram.jpeg)](./cli-extensions.md)

Extensions are defined as a process, that reads serialised configuration provided on `stdin` and replies through `stdout` and `stderr`. Extensible CLI takes care of building, providing and running the extensions.

## Timelines
All timelines are subject to change. They are reflecting our priorities at the times of writing.

- Early November 2022: Extensible CLI wrapper is the default Snyk CLI runtime.
- H1 2023: Use Snyk Extensions to develop and refactor Snyk product commands.

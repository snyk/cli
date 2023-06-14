# IaC rules init

## Usage

**Feature availability:** This feature is in beta.

`snyk iac rules init [<OPTIONS>]`

## Description

The `snyk iac rules init` command is an interactive command for initializing a new custom rules project structure, a new rule in an existing custom rules project, a new spec in an existing custom rules project, or a new relation in an existing custom rules project.

For a list of related commands run `snyk iac --help`

## Configure the Snyk CLI

You can use environment variables and set variables for connecting with the Snyk API; see [Configure the Snyk CLI](https://docs.snyk.io/snyk-cli/configure-the-snyk-cli)

## Debug

Use the `-d` option to output the debug logs.

## Examples for snyk iac rules init interactive experience

### **Initialize a new custom rules project structure**

```
snyk iac rules init
```

### Among "project," "rule," "rule spec," and "relation", select project structure option

`What do you want to initialize?`

`Filter: Type to filter choices`

&#x20; `project`

&#x20; `rule`

&#x20; `rule spec`

&#x20; `relation`

### Give the name of the project structure

`What do you want to initialize? project`

`Project name: project1 ✔`

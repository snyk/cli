# CLI Help files

Snyk CLI help files are in the `help/cli-commands` folder.

## Updating or adding help documents

All commands are documented in a Markdown format. They are automatically pushed to the [Snyk User Documentation site](https://docs.snyk.io).

Don't use HTML tags. These markdown files are the source for the `--help` command output in the Snyk CLI.

Contact **Team Hammer** or open an issue in this repository when in doubt.

### CLI options

```markdown
### `--severity-threshold=low|medium|high|critical`

Only report vulnerabilities of provided level or higher.
```

CLI flag should be a heading and in backticks. See already documented commands and flags for more examples.

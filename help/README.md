# CLI Help files

Snyk CLI help files are generated from markdown sources in `help/commands-docs` folder.

There is a simple templating system that pieces markdown sources together into a markdown that gets rendered.

## Updating or adding help documents

Contact **Team Hammer** or open an issue in this repository when in doubt.

Keep all changes in `help/commands-docs` folder, as that is used as source for generating Markdown, ronn and txt files. When you are done editing, or you want to preview your changes, run the `npm run generate-help` (see "Running locally" below for troubleshooting). Then commit all changes, including the generated files.

### CLI options

```markdown
- `--severity-threshold`=low|medium|high|critical:
  Only report vulnerabilities of provided level or higher.
```

CLI flag should be in backticks. Options (filenames, org names…) should use Keyword extension (see below) and literal options (true|false, low|medium|high|critical…) should be typed as above.

# CLI Help files

Snyk CLI help files are generated from markdown sources in `help/commands-docs` folder.

There is a simple templating system that pieces markdown sources together. Those are later transformed into a [roff (man-pages) format](<https://en.wikipedia.org/wiki/Roff_(software)>). Those are then saved as plaintext to be used by `--help` argument.

1. Markdown fragments
2. Markdown documents for each command
3. roff man pages
4. plain text version of man page

Since [package.json supports specifying man files](https://docs.npmjs.com/cli/v6/configuring-npm/package-json#man), they will get exposed under `man snyk`.

This system improves authoring, as markdown is easier to format. It's keeping the docs consistent and exposes them through `man` command.

## Updating or adding help documents

Contact **Team Hammer** or open an issue in this repository when in doubt.

Keep all changes in `help/commands-docs` folder, as other folders are ignored by `.gitignore` file and are auto-generated in CI pipeline.

See other documents and help files for hints on how to format arguments. Keep formatting simple, as the transformation to `roff` might have issues with complex structures.

### CLI options

```md
- `--severity-threshold`=low|medium|high|critical:
  Only report vulnerabilities of provided level or higher.
```

CLI flag should be in backticks. Options (filenames, org names…) should use Keyword extension (see below) and literal options (true|false, low|medium|high|critical…) should be typed as above.

### Keyword extension

There is one non-standard markdown extension:

```md
<KEYWORD>
```

Visually, it'll get rendered as underlined text. It's used to mark a "variable". For example this command flag:

```md
- `--sarif-file-output`=<OUTPUT_FILE_PATH>:
  (only in `test` command)
  Save test output in SARIF format directly to the <OUTPUT_FILE_PATH> file, regardless of whether or not you use the `--sarif` option.
  This is especially useful if you want to display the human-readable test output via stdout and at the same time save the SARIF format output to a file.
```

## Running locally

- Either have docker running, or have `groff` and `ronn` (really
  [ronn-ng](https://github.com/apjanke/ronn-ng)) on your `$PATH`.
- have `npm`/`npx` available

```
$ npm run generate-help
```

Or, if you already have `groff` and `ronn`, and don't want to use Docker:

```
$ NO_DOCKER=1 npm run generate-help
```

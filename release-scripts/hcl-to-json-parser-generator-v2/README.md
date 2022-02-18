# HCL to JSON v2

This package uses GopherJS[1] to convert the snyk/snyk-iac-parsers
Golang package into JavaScript and provide it as a CommonJS module.
It is suffixed with v2 as we already have an existing hcl2json implementation,
which we will deprecate when we fully switch to this implementation.

## Build

The current path of this folder has to be added into the \$GOPATH environment variable for
the build to work (this is currently a requirement of GopherJS).
e.g:

```
export GOPATH=$HOME/dev/snyk/release-scripts/hcl-to-json-parser-generator-v2
```

Make sure that your `$GOROOT` environment variable is set to where go is installed, for example:

```
GOROOT="/usr/local/go"
```

Then, from this working directory run:

    % make build

This will generate two files a hcltojson-v2.js and an hcltojson-v2.js.map with
source maps for the minified file.
You can find these files under `/release-scripts/hcl-to-json-parser-generator-v2/src/hcltojson-v2/dist/`

The output file is ~4.0M minified and ~716K gzipped.

## Usage

The module exposes one function:

- `func parseModule(files map[string]interface{}) map[string]interface{}` this takes a map of files as input and returns a map of parsedFiles and failedFiles as output:
  ```javascript
  const { parseHCL2JSON } = require('./hcltojson-v2');
  const fileContent = fs.readFileSync('../path/to/terraform.tf', 'utf-8');
  const { parsedFiles, failedFiles } = parseModule({
    '../path/to/terraform.tf': fileContent,
    'file2.tf': 'content2',
  });
  ```

## Test

A simple assertion that the compiled file works can be run via:

    % make test

## Local development

To point to a different version of the `snyk/snyk-iac-parsers` locally, you will need to follow these steps:

- copy your preferred commit(https://github.com/snyk/snyk-iac-parsers/commits/)
- and then, while in `/release-scripts/hcl-to-json-parser-generator-v2/src/hcltojson-v2` directory, run:

```shell
 go get github.com/snyk/snyk-iac-parsers@commithash
```

- then, going back to this directory (`/release-scripts/hcl-to-json-parser-generator-v2/`), run:

```shell
make build
```

- Run `make test` to validate that tests are still passing.

## Updating the snyk/snyk-iac-parsers package for production use

The generated GopherJS artefact is used in `src/cli/commands/test/iac-local-execution/parsers/hcl-to-json-v2/`

There are two ways to do this:

- use the automatic release process with the Makefile rule `release` (Automatic release)
- do it manually by following the guide below (Manual Release)

#### Automatic release process

To check that the new version still works and is ready to be released:

- copy the targeted tag from https://github.com/snyk/snyk-iac-parsers/tags
- and then, while in `/release-scripts/hcl-to-json-parser-generator-v2/` directory, run:

```shell
 make release version=${version_or_sha}
```

e.g.

```shell
make release version=v0.2.0
```

This will get the required version, check for errors, run the tests against the new versions and copy the artefact to the iac-local-execution directory.
In a case of a failure, it will revert the changes and fail gracefully.

#### Manual release process

This is a similar process to the local development, but you also need a couple of extra steps:

- copy the targeted tag from https://github.com/snyk/snyk-iac-parsers/tags
- and then, while in `/release-scripts/hcl-to-json-parser-generator-v2/src/hcltojson-v2` directory, run:

```shell
 go get github.com/snyk/snyk-iac-parsers@tag
```

- then, going back to this directory (`/release-scripts/hcl-to-json-parser-generator-v2/`), run:

```shell
make build
```

- Run `make test` to validate that tests are still passing.
- Run the following shell script: `copy-artefact-to-destination.sh`, this will overwrite the current artefact being used by the Terraform parser.
- Add a line containing the text: `/* eslint-disable */` in the very first line of the newly built artefact to avoid linting.

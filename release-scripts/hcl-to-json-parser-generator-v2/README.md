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

The generated GopherJS artefact is used... TBC (not used yet by the CLI)

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

TBC: This still needs confirmation and update when we decide where we are going to use it. Currently it copies the artifact at the same place as before (iac-local-execution/parsers/terraform-parser).
We need to change this accordingly when we decide the use of it.

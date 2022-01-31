# HCL to JSON

This package uses GopherJS[1] to convert the tmccombs/hcl2json/convert[2]
Golang package into JavaScript and provide it as a CommonJS module. Currently
this uses the v0.3.1 of tmccombs/hcl2json due to breaking changes in the output between 0.3.1 and
0.3.2.

## Build

The current path of this folder has to be added into the \$GOPATH environment variable for
the build to work (this is currently a requirement of GopherJS).
e.g:

```
export GOPATH=$HOME/dev/snyk/release-scripts/hcl-to-json-parser-generator
```

Make sure that your `$GOROOT` environment variable is set to where go is installed, for example:

```
GOROOT="/usr/local/go"
```

Then, from this working directory run:

    % make build

This will generate two files a hcltojson.js and an hcltojson.js.map with
source maps for the minified file.
You can find these files under `/release-scripts/hcl-to-json-parser-generator/src/hcltojson/dist/`

The output file is ~3.9MB minified and ~700KB gzipped.

## Usage

The module exposes a single function `hcltojson()` this takes a string
of HCL2 and returns a JavaScript object:

    const { hcltojson } = require('./hcltojson');
    const tf = fs.readFileSync('../path/to/terraform.tf', 'utf-8');
    const data = hcltojson(tf);

## Test

A simple assertion that the compiled file works can be run via:

    % make test

This will check the parsed result of the example.tf function matches the
content of fixture.json.

## Updating the Terraform parser

The generated GopherJS artefact is currently being used only for the IaC terraform scanning flow in order to parse raw HCL into structured JSON,
the integration point can be found under `/src/cli/commands/test/iac-local-execution/parsers/terraform-file-parser.ts`.

In case that this artefact has to updated and replace, please follow the next steps:

1. Build a new artefact with `make build`.
2. Validate it passes the tests with `make test`.
3. Run the following shell script: `copy-artefact-to-destination.sh`, it will overwrite the current artefact being used by the Terraform parser.

## TODO

1. Support the latest 0.3.2 version of hcl2json.

[1]: https://github.com/gopherjs/gopherjs
[2]: https://github.com/tmccombs/hcl2json/

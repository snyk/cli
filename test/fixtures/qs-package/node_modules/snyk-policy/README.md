# snyk-policy

[![Build Status](https://travis-ci.org/Snyk/policy.svg?branch=master)](https://travis-ci.org/Snyk/policy) [![Coverage Status](https://coveralls.io/repos/Snyk/policy/badge.svg?branch=master&service=github)](https://coveralls.io/github/Snyk/policy?branch=master)

Loads Snyk policy files, typically name `.snyk`, parses them and returns a structure policy object.

From there, the policy object can `filter` vulnerabilities based on `vuln.id` and path (`vuln.from`) matching.

Policies can also load from multiple locations, and optionally support trusting deep policies, or ignoring all policies entirely.

## How it works

The policy module is written to support future versions of policy formats, so you shouldn't need to worry about what version you're dealing with.

The policy is loaded, typically this will be a YAML file named `.snyk` (but can be loaded from another filename).

This returns an object that has the following public keys:

- `ignore` Object
- `patch` Object
- `suggest` Object (optionally depending on the policy config)
- `version` String

The `ignore`, `patch` and `suggest` all have similar top level structures. For example:

```text
ignore: {
  '<snyk-vuln-id>': [
    {
      '<module path>': { <metadata> }
    }
  ]
}
```

The metadata for ignore and suggest are the same:

```js
{
  reason: '<string>',
  expires: '<JSON date format>'
}
```

The metadata for patch is:

```js
{
  patched: '<JSON date format>'
}
```

For a full example of a fully parsed policy file, see [this fixture example](https://github.com/Snyk/policy/blob/a96862bf1c14e78640611640716c05be2e4a8afd/test/fixtures/ignore/parsed.json).

The vulnerability report is passed in to the instance `.filter` function and the vulns are filtered out based on the ignore rules and the patch rules.

If there is any suggest keys on the policy a `note` property is added to the individual vulnerability it matches.

### How filtering works

The filtering works on two levels:

1. matches on `vuln.id`
2. matches the `vuln.from` against the module path

If first (1) is satisfied, then (2) is checked. If ignoring, the vulnerability is stripped from the report.

If the rule is listed in the patches, the Snyk patch file is also checked to ensure it exists (this is a way to validate the patch has actually taken place - but note that this can be circumvented when the file system isn't available, see [skipping patch verification](#skipVerifyPatch).

A module path is constructed by the name and then optionally the version or version range. A star rule (`*`) is also supported.

### Module path rules

Given the following dependency tree, and assuming we have a known vulnerability in semver@2.3.2:

```text
.
└─┬ @remy/protect-test@1.0.7
  ├── semver@2.3.2
  └─┬ snyk@0.5.0
    ├─┬ os-name@1.0.3
    │ └─┬ win-release@1.1.1
    │   └── semver@5.1.0
    ├── semver@5.1.0
    └─┬ update-notifier@0.5.0
      └─┬ semver-diff@2.1.0
        └── semver@5.1.0
```

The following are examples of module paths that could target the semver vulnerability (note that the root module name is not part of the path, represented as `.` in the tree above):

```text
@remy/protect-test > semver
@remy/protect-test@1.0.7 > semver@2.3.2
* > semver
* > semver@2.x
```

The first example rule (above) is how the policy is stored by default. However, policy files can be manually edited if desired.

## Usage

Installed via npm: `npm install -S snyk-policy`. Typically loaded and applied to vulnerabilities:

```js
var policy = require('snyk-policy');

var vulns = snyk.test('snyk-demo-app@1.0.0'); // assumes snyk is loaded
policy.load(process.cwd()).then(rules => {
  console.log(rules.filter(vulns));
});
```

## Skipping patch verification

Before the policy runs the filter, if the policy return object includes the property `skipVerifyPatch: true` then the check for the patch file will not be performed.

This is in use in the [registry (private repo)](https://github.com/Snyk/registry/blob/feat/policies/lib/snapshots.js#L112-L117) and is useful when the policy loading doesn't have local access to the file system that the packages live on.

## API

### policy.load(root[, options])

Parses and loads a given directory or directories. Returns a `promise`.

#### `root`: String | Array

This can be a string pointing to a directory (if so, must include a `.snyk` file inside) or you can define the specific filename to load, i.e. `./my-policy`.

If an array is given, the first policy is the primary, and the subsequent policies will inherit the module path from the primary policy.

**Important:** All secondary policy `ignore` rules are ignored and treated as suggestions, adding a `note` property on the vulnerability.

#### `options`: Object

- `ignore-policy: true` ignores all the policy rules and returns an empty policy (use in `snyk test --ignore-policy`)
- `trust-policies: true` applies `ignore` rules in secondary policies (and doesn't offer them as suggestions)
- `loose: true` do not throw an exception if the policy can't be loaded from disk
- `skipPatchValidation

### policy.loadFromText(string)

Parses the string and returns the policy. Returns a `promise`.

#### `string`: String

A raw YAML string.

### policy.save(config[, root, progress]) & .save([root, progress])

Save the policy to disk in the latest format, so if the original policy version was `v1` and the newest is `v2`, the policy will be upgraded.

Note that this method is also available on the response object from [`.load`](#policyloadroot-options), so can be called as `res.save()` (where `res` is the loaded config).

Returns a `promise`.

#### `config`: Object

The structure policy object.

#### `root`: String

The directory to save the policy file (`.snyk`). Defaults to CWD via `process.cwd()`.

### `progress`: Promise

A progress indicator, as used in [snyk cli](https://github.com/Snyk/snyk-internal/blob/0459a7b21709c6a1d3c5edeb61b4abf2103ffaf0/cli/commands/protect/wizard.js#L268).

### policy.filter(config, vulns) & .filter(vulns)

Applies the policy to the vulnerabilities object. The `vulns` object is expected as:

```js
{
  ok: Boolean,
  vulnerabilities: Array
}
```

If all the vulns are stripped because of the policy, then the `ok` bool is set to `true`.

Note that this method is also available on the response object from [`.load`](#policyloadroot-options), so can be called as `res.filter()` (where `res` is the loaded config).


Returns an `object` in the same structure as `vulns`.

### policy.getByVuln(config, vuln)

Returns any matching rule given a specific vulnerability object. The `vuln` object must contain `id` and `from` to match correctly.

Returns an `object` structured as:

```js
{
  type: String, // ignore | patch
  id: String, // vuln.id
  rule: Array, // array of package@version
  reason: String, // included in ignore rules
  expires: String, // JSON time included in ignore rules
}
```

#### `config`: Object

The loaded policy object (from `.load`).

#### `vuln`: Object

Single vulnerability object.

## Misc

* [CONTRIBUTING.md](.github/CONTRIBUTING.md)
* [License: Apache License, Version 2.0](LICENSE)

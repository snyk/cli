# Documentation

Snyk helps you find, fix and monitor for known vulnerabilities in Node.js npm packages, both ad hoc and as part of your CI (Build) system.

* Get started with our __<a href="https://snyk.io/docs/quick-start/" title="Quick start guide">step-by-step guide.</a>__
* <a href="https://snyk.io/docs/using-snyk/" title="Using Snyk">__Check our full documentation on snyk.io__</a> for details. 

Note: Snyk is currently in beta. [Email us your feedback](mailto:support@snyk.io).

## CLI

```console
snyk [options] [command] [package]
```

The package argument is optional. If no package is given, Snyk will run the command against the current working directory allowing you test you non-public applications.

Run `snyk --help` to get a quick overview of all commands. 

## Integrating Snyk into your dev workflow

To continuously avoid known vulnerabilities in your dependencies, integrate Snyk into your continuous integration (a.k.a. build) system. Here are the steps required to to so:

1. Add `snyk` to your project's dependencies (`npm install -S snyk`), and commit the modified `package.json` file.
2. Ensure the `.snyk` file you generated was added to your source control (`git add .snyk`).
3. After the `npm install` steps in your CI, run [`snyk protect`](#protect) to apply any necessary patches.
4. Run [`snyk test`](#test) to identify on any known vulnerabilities not already ignored or patched. If such vulnerabilities were found, [`snyk test`](#test) will return a non-zero value to fail the test.

## Badge

Once you’re vulnerability free, you can put a badge on your README showing your package has no known security holes. This will show your users you care about security, and tell them that they should care too.

If there are no vulnerabilities, this is indicated by a green badge.

[![Known Vulnerabilities](https://snyk.io/package/npm/name/badge.svg)](https://snyk.io/package/npm/name)

If vulnerabilities have been found, the red badge will show the number of vulnerabilities. 

[![Known Vulnerabilities](https://snyk.io/package/npm/jsbin/badge.svg)](https://snyk.io/package/npm/jsbin)

Get the badge by copying the relevant snippet below and replacing "name" with the name of your package.

HTML:

```
<img src="https://snyk.io/package/npm/name/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/package/npm/name style="max-width:100%;">
```

Markdown:

```
[![Known Vulnerabilities](https://snyk.io/package/npm/name/badge.svg)](https://snyk.io/package/npm/name)
```

## Credits

<p>We monitor existing node.js security portals and tools, such as <a href="https://nodesecurity.io/">Node Security Project</a>, the <a href="https://groups.google.com/forum/#!forum/nodejs-sec">nodejs-sec Google Group</a>, <a href="https://srcclr.com/">SRC:CLR</a>, or <a href="http://retirejs.github.io/retire.js/">Retire.js</a>. We also monitor Github activity and other online sources for new vulnerabilities.</p>

[![Analytics](https://ga-beacon.appspot.com/UA-69111857-2/Snyk/snyk?pixel)](https://snyk.io/)

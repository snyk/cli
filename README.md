# Documentation

Snyk helps you find and fix known vulnerabilities in your Node.js dependencies, both ad hoc and as part of your CI (Build) system.

Note: Snyk is currently in beta. [Email us your feedback](mailto:support@snyk.io).

## Installation & getting started

Snyk is installed via npm. Run these commands to install it for local use:

```shell
npm install -g snyk
```

Once installed, you can perform a quick test on a public package, for instance:

```shell
snyk test ionic@1.6.5
```

As you can see, Snyk found and reported several vulnerabilities in the package. For each issue found, Snyk provides the severity of the issue, a link to a detailed description, the path through which the vulnerable module got into your system, and guidance on how to fix the problem.

```text
$ snyk test
✗ Vulnerability found on gm@1.13.3
Info: https://dev.snyk.io/vuln/npm:gm:20151026
From: snyk-demo-app@latest > gm@1.13.3
Upgrade direct dependency gm@1.13.3 to gm@1.21.1

✗ Vulnerability found on qs@0.6.6
Info: https://dev.snyk.io/vuln/npm:qs:20140806
From: snyk-demo-app@latest > webdriverio@2.4.5 > request@2.34.0 > qs@0.6.6
Upgrade direct dependency webdriverio@2.4.5 to webdriverio@3.0.1 (triggers upgrades to request@2.40.0 > qs@1.0.0)

✗ Vulnerability found on qs@0.4.2
Info: https://dev.snyk.io/vuln/npm:qs:20140806-1
From: snyk-demo-app@latest > cucumber@0.3.0 > connect@2.3.2 > qs@0.4.2
No direct dependency upgrade can address this issue.
Run `snyk wizard` to explore remediation options
```

In the next sections we'll explain how to run the same test on your own projects.

## Authentication

Some Snyk commands require authentication. We use GitHub for authentication, but **do not require access to your repositories**, only your email address. You can authenticate by browsing to the [Snyk website](https://snyk.io), clicking "[Sign Up](https://app.snyk.io/auth/github)", and pasting in the lines from your dashboard, which look roughly like this:

```shell
snyk auth <your key>
```

Alternatively, you can simply run `snyk auth` in your terminal and it'll guide you through this process. Once authenticated, you can proceed to run Snyk's [`wizard`](#wizard).

## Wizard

Snyk's `wizard` walks you through finding and fixing the known vulnerabilities in your project. It leverages the separate [`test`](#test), [`protect`](#protect) and [`monitor`](#monitor) actions, supported by an interactive workflow. To run the wizard, simply navigate to your project folder and run `snyk wizard` like so:

```shell
cd ~/projects/
snyk wizard
```

The wizard goes through multiple phases.

First, it takes stock of which dependencies are locally installed, queries the snyk service for related known vulnerabilities, and asks you how you want to address each vulnerability that was found. As you answer the questions, the wizard will create a Snyk policy file, stored in a file named `.snyk`, which will guide future Snyk commands.

Here are the possible remediation steps for each vulnerability:

* **Upgrade** - if upgrading a direct dependency can fix the current vulnerability, the wizard can automatically modify your `package.json` file to use the newer version and run `npm update` to apply the changes.
* **Patch** - Sometimes there is no direct upgrade that can address the vulnerability, or there is one but you can't upgrade due to functional reasons (e.g. it's a major breaking change). For such cases, the wizard lets you patch the issue (using patches the Snyk team created and maintain). This option will make the minimal modifications to your locally installed module files to fix the vulnerability. It will also update the policy to patch this issue when running [`snyk protect`](#protect), as shown below.
* **Ignore** - If you believe this vulnerability is not exploitable, you can set the Snyk policy to ignore this vulnerability. By default, we will ignore the vulnerability for 30 days, to avoid easily hiding a true issue. If you want to ignore it permanently, you can manually edit the generated `.snyk` file. If neither a patch nor an upgrade are available, you can choose to ignore the issue for now, and we'll notify you when a new patch or upgrade is available.


```shell
$ snyk wizard

Snyk's wizard will:

  * Enumerate your local dependencies and query Snyk's servers for vulnerabilities
  * Guide you through fixing found vulnerabilities
  * Create a .snyk policy file to guide snyk commands such as test and protect
  * Remember your dependencies to alert you when new vulnerabilities are disclosed

Loading dependencies...
Querying vulnerabilities database...
Tested 228 dependencies for known vulnerabilities, found 5 vulnerabilities.

? High severity vulnerability found in gm@1.13.3
  - info: https://dev.snyk.io/vuln/npm:gm:20151026
  - from: snyk-demo-app@latest > gm@1.13.3 Upgrade

? Medium severity vulnerability found in qs@0.6.6
  - info: https://dev.snyk.io/vuln/npm:qs:20140806
  - from: snyk-demo-app@latest > webdriverio@2.4.5 > request@2.34.0 > qs@0.6.6
  Upgrade to webdriverio@3.0.1
❯ Patch (modifies files locally, updates policy for `snyk protect` runs)
  Set to ignore for 30 days (updates policy)
  Skip
```

Once all the issues are addressed, `snyk wizard` will optionally integrate some tests and protection steps into your `package.json` file.

It can add [`snyk test`](#test) to the `test` script, which will query your local dependencies for vulnerabilities and err if found (except those you chose to ignore). In addition, if you chose to patch an issue, the wizard will also optionally add [`snyk protect`](#protect) to your project as a `post-install` step. This is helpful if you publish this module, as it will repeatedly patch the issues specified in `.snyk` every time a module is installed.

Once you've gone through all the issues, the wizard will create the `.snyk` file, modify `package.json` and run `npm update` to apply the changes. Lastly, the wizard will take a snapshot of your current dependencies (similar to running [`snyk monitor`](#monitor)), so we can inform you of newly disclosed vulnerabilities in them, or when a previously unavailable patch or upgrade path are created.

### A few things to note:

- The wizard doesn't perform any git (or source control) actions, so be sure to add the `.snyk` file to your repository.
- Subsequent runs of the wizard will not show items previously ignored. To start a-fresh, run `snyk wizard --ignore-policy`.
- By default, both `wizard` and [`test`](#test) ignore devDependencies. To test those, add the `--dev` flag.

## Test

To only test your project for known vulnerabilities, browse to your project's folder and run `snyk test`:

```shell
cd ~/projects/myproj/
snyk test
```

`snyk test` takes stock of all the local dependencies and queries the snyk service for related known vulnerabilities. It displays the found issues along with additional information, and suggests remediation steps. Since `snyk test` looks at the locally installed modules, it needs to run after `npm install`, and will seamlessly work with `shrinkwrap`, npm enterprise or any other custom installation logic you have.

`snyk test` can also get a folder name as an argument, which is especially handy if you want to test multiple projects. For instance, the following command tests all the projects under a certain folder for known vulnerabilities:

```shell
cd ~/projects/
snyk test *
```

Lastly, you can also use `snyk test` to scrutinize a public package before installing it, to see if it has known vulnerabilities or not. Using the package name will test the latest version of that package, and you can also provide a specific version or range using `snyk test module[@semver-range]`.

```shell
snyk test lodash
snyk test ionic@1.6.5
```

To address the issues `snyk test` found, run [`snyk wizard`](#wizard).

## Protect

The `protect` command applies the patches specified in your `.snyk` file to the local file system. You should only run `snyk protect` after you've created a .snyk file and installed your local dependencies (e.g. by running `npm install`).

Since running `protect` is the way to repeatedly apply patches, you should run it every time you reinstall your modules. Common integration points would be your CI/build system, your deployment system, and adding it as a post-install step in your `package.json` file (necessary if you consume this module via `npm`).

## Monitor

With [`test`](#test) and [`protect`](#protect), you're well set up to address currently known vulnerabilities. However, new vulnerabilities are constantly disclosed - which is where `monitor` comes in.

```shell
cd ~/projects/myproject/
snyk monitor
```

Just before you deploy, run `snyk monitor` in your project directory. This will take a snapshot of your current dependencies, so we can notify you about newly disclosed vulnerabilities in them, or when a previously unavailable patch or upgrade path are created. If you take multiple snapshots of the same application, we will only alert you to new information about the latest one.

```shell
$ snyk monitor
Captured a snapshot of this project's dependencies. Explore this snapshot at https://app.snyk.io/monitor/1a53f19a-f64f-44ab-b122-74ce82c1c34b
Notifications about newly disclosed vulnerabilities related to these dependencies will be emailed to you.
```

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

_Note:_ The badge works off the npm package, and does not factor in .snyk files yet. (This means that ignored vulnerabilities will not be taken into account). 

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

While we use multiple sources to determine vulnerabilities, the primary (current) source is the [Node Security project](http://nodesecurity.io).
[![Analytics](https://ga-beacon.appspot.com/UA-69111857-2/Snyk/snyk?pixel)](https://snyk.io/)

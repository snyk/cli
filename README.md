# Snyk - So Now You Know!

Note: Snyk is currently only available for private beta testing.
If you're not a part of the private beta and want to be, please [email us](mailto:contact@snyk.io).

Snyk will help you reduce the security risk introduced by the use of third party dependencies.
It informs you of known vulnerabilities in the packages used in your projects, helps you fix those issues, and alerts you when new vulnerabilities are disclosed.

Snyk is easy to integrate into your Continuous Integration system, where you can patch individually chosen vulnerabilities and warn or err on new ones. If you own an open source project and have a vulnerable downstream dependency, snyk can ensure the vulnerability is patched as part of your app/package installation process.

Snyk is currently only available for Node.js projects. More language will be supported in the future.

## Getting Started
To get up and running quickly, run these commands (requires having [npm installed](http://blog.npmjs.org/post/85484771375/how-to-install-npm)): 
```shell
npm install -g snyk
snyk auth
snyk test ionic@1.6.5
```

You now have a working installation of Snyk, and can see the results of testing an older version of a public package and seeing the known vulnerabilities it contained. In your dev process you'll likely be running this test on your own code instead, which is what we'll explain in the next steps.

## test

Use `snyk test` to find known vulnerabilities in your projects. To get started, browse to a project you'd like to test, and run `snyk test`
```shell
cd ~/node/project/to/test/
snyk test
```

`snyk test` will take stock of all the local dependencies and their installed versions, and report them to Snyk. The Snyk servers will check will check if there are known vulnerabilities on these dependencies, and if so report about them and and suggest any remediation you can take. Since `snyk test` looks at the locally installed modules, it needs to run after `npm install`, and will seamlessly work with `shrinkwrap`, npm enterprise or any other custom installation logic you have.

You can also use `snyk test` to scrutinize a public package before installing it, to see if it has known vulnerabilities or not.
```shell
# example uses
snyk test lodash
snyk test ionic@1.6.5
```

Using `snyk test` without an argument will test the current working directory and walk the local dependencies and installed versions. It will then give you a report on whether there are any known vulnerabilities in those dependencies and suggest any remediation you can take. Since `snyk test` looks at the locally installed modules, it needs to run after `npm install`, and will seamlessly work with `shrinkwrap`, npm enterprise or any other custom installation logic you have.

The test command also accepts a package and version as an optional argument. If you wanted to test a module you don't have locally, you can `snyk test module[@semver-range]`.

If `snyk test` found vulnerabilities, the process with exit with a non-zero exit code. Our recommendation is that you add `snyk test` to your CI tests, failing the tests (and build) if a known vulnerability is found. Note that `snyk test` can ignore vulnerabilities specified in the .snyk file, as explained in the `protect` section.

## protect

Snyk's `protect` functionality allows you to patch vulnerabilities that can't be remediated through an upgrade (*note that patch is not yet available in this stage of the private beta, but coming soon*). 

To get started, run protect in interactive mode:
```shell
snyk protect -i
```

This interactive mode will run a test again, and then guide you through how to address every issue found. Once completed, `snyk protect -i` will create a local `.snyk` file that guides non-interactive executions of `snyk protect`. Note that `snyk protect` will never unilaterally decide to ignore or patch a vulnerability - it will simply follow the guidance captured in the `.snyk` file.

Here are the possible remediation steps for each vulnerability:

- `Upgrade` - if upgrading a direct dependency can fix the current vulnerability, `snyk protect` can automatically modify your Package.json file to use the newer version.
- `Ignore` - If you believe this vulnerability does not apply to you, or if the dependent module in question never runs on a production system, you can choose to ignore the vulnerability. By default, we will ignore the vulnerability for 30 days, to avoid easily hiding a true issue. If you want to ignore it permanently, you can edit the generated `.snyk` file.
- `Patch` - We maintain a growing database of patches that can fix a vulnerability by locally modifying the releant dependency files. If there's no available upgrade, or if you cannot upgrade due to functional reasons (e.g. it's a major breaking change), you should patch. If you patched at least one known vulnerability, `snyk protect --interactive` will also add `snyk protect` (no parameters) to your Package.json post-install step. *Note: patch is not yet enabled in the private beta, it will be soon. In the meantime, patch will be replaced with a short ignore*.

## Integrating Snyk into your dev workflow

To continuously test against and protect from known vulnerabilities, integrate Snyk into your continuous integration (a.k.a. build) system. Here are the steps required to to so:
. Add `snyk` to your project's dependencies (`npm install -S snyk`), and commit the change in
. Ensure the `.snyk` file you generated was added to your source control (`git add .snyk`);
. After the `npm install` steps in your CI, run `snyk protect` to apply any necessary patches
. Run `snyk test` to identify (and err) on any known vulnerabilities not already ignored or patched.

A few potential alternatives to consider:
- Add `snyk test` to your Package.json `test` scripts, to capture them in local `npm test` runs. 
- Add `snyk test` as a `post-install` step in your Package.json file, to immediately spot any newly added module which has known vulnerabilities
- Add `snyk protect` as a `post-install` step in your Package.json file, to apply patches even while working locally

Note: During private beta, all snyk actions require authentication. This means modifying your Package.json will require your entire team to first run `snyk auth`. If you don't want that, hold off on modifying your Package.json file for now. 

## monitor

With `test` and `protect`, you should be well setup to address currently known vulnerabilities. However, new vulnerabilities are constantly disclosed, which is where `monitor` comes in.

Just before you deploy, run `snyk monitor` in your project directory. This will post a snapshot of your full dependency tree to Snyk's servers, where they will be stored. Those dependencies will be tracked for newly discolsed vulnerabilities, and we will alert you if a new vulnerability related to those dependencies is disclosed.

```shell
# example uses
cd ~/node/project/to/test/
snyk monitor
# a snyk.io monitor response URL is returned
```

## More About Authentication

During the private beta, you will need to authenticate with snyk before being able to use any of it's features. Once public, `test` and `protect` will be available without the need to `auth`.

Authentication requires you to have a GitHub account, but *does not require access to your repositories* - we simply use Github to spare you managing another set of credentials. Run `snyk auth` and follow the on screen instructions.

If you are authenticating on a remote machine (that doesn't have access to open a browser to GitHub) you can use your API key from https://snyk.io and authenticate directly on the command line using `snyk auth <key>`.

## Credits

While we use multiple sources to determine vulnerabilities, the primary (current) source is the [Node Security project](http://nodesecurity.io).

# Snyk - So Now You Know!

Note: Snyk is currently only available for private beta testing. 
If you're not a part of the private beta and want to be, please [email us](mailto:contact@snyk.io). 

Snyk will help you reduce the security risk introduced by the use of third party dependencies. 
It informs you of known vulnerabilities in the packages used in your projects, helps you fix those issues, and alerts you when new vulnerabilities are disclosed. 

Snyk is easy to integrate into your Continuous Integration system, where you can patch individually chosen vulnerabilities and warn or err on new ones. If you own an open source project and have a vulnerable downstream dependency, snyk can ensure the vulnerability is patched as part of your app/package installation process.

Snyk is currently only available for Node.js projects. More language will be supported in the future.

## Installation

The Snyk CLI tool is installed via [npm](http://blog.npmjs.org/post/85484771375/how-to-install-npm).
From your terminal, simply run the following command:

```shell
npm install -g snyk
```

You now have `snyk` installed as a command line utility, and are ready to `auth` and use Snyk.

## Using snyk

During the private beta, you will need to authenticate with snyk before being able to use any of it's features. Once public, it's likely `test` and `protect` will be available without the need to `auth`.

Authentication requires you to have a GitHub account, but *does not require access to your repositories* - we simply use Github to spare you managing another set of credentials. Run `snyk auth` and follow the on screen instructions.

Once authenticated, you can use the following commands:

- `snyk test`
- `snyk protect`
- `snyk monitor`

## test

```shell
# example uses
snyk test
snyk test ionic@1.6.5
snyk test lodash
```

Using `snyk test` without an argument will test the current working directory and walk the local dependencies and installed versions. It will then give you a report on whether there are any known vulnerabilities in those dependencies and suggest any remediation you can take. Since `snyk test` looks at the locally installed modules, it needs to run after `npm install`, and will seamlessly work with `shrinkwrap`, npm enterprise or any other custom installation logic you have.

The test command also accepts a package and version as an optional argument. If you wanted to test a module you don't have locally, you can `snyk test module[@semver-range]`.

If `snyk test` found vulnerabilities, the process with exit with a non-zero exit code. Our recommendation is that you add `snyk test` to your CI tests, failing the tests (and build) if a known vulnerability is found. Note that `snyk test` can ignore vulnerabilities specified in the .snyk file, as explained in the `protect` section.

## protect

Snyk's `protect` functionality allows you to patch vulnerabilities that can't be remediated through an upgrade (*not yet available in this stage of the private beta, but coming soon*).

Running `snyk protect` without parameters will follow the instructions specified in the `.snyk` configuration file. To generate the initial `.snyk` file, start by running `protect` in interactive mode by typing `snyk protect --interactive`.This will prompt you asking what to do about each vulnerability, giving you the following options:

- `Upgrade` - if upgrading a direct dependency can fix the current vulnerability, `snyk protect` can automatically modify your Package.json file to use the newer version.
- `Ignore` - If you believe this vulnerability does not apply to you, or if the dependent module in question never runs on a production system, you can choose to ignore the vulnerability. By default, we will ignore the vulnerability for 30 days, to avoid easily hiding a true issue. If you want to ignore it permanently, you can edit the generated `.snyk` file.
- `Patch` - We maintain a growing database of patches that can fix a vulnerability by locally modifying the releant dependency files. If there's no available upgrade, or if you cannot upgrade due to functional reasons (e.g. it's a major breaking change), you should patch. If you patched at least one known vulnerability, `snyk protect --interactive` will also add `snyk protect` (no parameters) to your Package.json post-install step. *Note: patch is not yet enabled in the private beta, it will be soon. In the meantime, patch will be replaced with a short ignore*.

Once you generated the `.snyk` file, add it to your source code repository, and add `snyk protect` to your CI process. `snyk protect` should run after `npm install` (and any other installation steps), so all the modules are in place and can be patched, but before `snyk test`, so that new (and not ignored) vulnerabilities will still fail the test.

## monitor

With `test` and `protect`, you should be well setup to address currently known vulnerabilities. However, new vulnerabilities are constantly disclosed, which is where `monitor` comes in. 

Just before you deploy, run `snyk monitor` in your project directory. This will post a snapshot of your full dependency tree to Snyk's servers, where they will be stored. Those dependencies will be tracked for newly discolsed vulnerabilities, and we will alert you if a new vulnerability related to those dependencies is disclosed.

```shell
# example uses
cd ~/dev/acme-project
snyk monitor
# a snyk.io monitor response URL is returned
```

## Credits

While we use multiple sources to determine vulnerabilities, the primary (current) source is the [Node Security project](http://nodesecurity.io).

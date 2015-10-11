# Snyk - So Now You Know!

Note: Snyk is currently only available for private beta testing. [Email us](mailto:contact@snyk.io) if you want to join the beta.

## Installation & Getting Started

Snyk helps you find and fix known vulnerabilities in your Node.js dependencies, both ad hoc and as part of your CI (Build) system. 

To get up and running quickly, run these commands to install, authenticate and perform a quick test. Note that while we authenticate using GitHub, we *do not* require access to your repositories (only your email):
```shell
npm install -g snyk
snyk auth
snyk test ionic@1.6.5
```

You can now see an example of several known vulnerabilities found on an older version of `ionic`, as well as guidance on how to understand and address them. In the next sections we'll explain how to run the same test on your own projects.

## test

To test your own project for known vulnerabilities, browse to your project's folder and run `snyk test`, like so (swapping the folder with your project's folder):
```shell
cd ~/projects/myproj/
snyk test
```

`snyk test` will take stock of all the local dependencies and their installed versions, and report them to Snyk. The Snyk servers will check if there are known vulnerabilities on these dependencies, and if so report about them and and suggest any remediation you can take. Since `snyk test` looks at the locally installed modules, it needs to run after `npm install`, and will seamlessly work with `shrinkwrap`, npm enterprise or any other custom installation logic you have.

`snyk test` can also get a folder name as an argument, which is especially handy if you want to test multiple projects. For instance, the following command tests all the projects under a certain folder for known vulnerabilities:
```shell
cd ~/projects/
find . -type d -maxdepth 1 | xargs -t -I{} snyk test  {}
```

Lastly, you can also use `snyk test` to scrutinize a public package before installing it, to see if it has known vulnerabilities or not. Using the package name will test the latest version of that package, and you can also provide a specific version or range using `snyk test module[@semver-range]`.
```shell
snyk test lodash
snyk test ionic@1.6.5
```

If you ran snyk locally and found vulnerabilities, you should proceed to use `snyk protect` to address them.

## protect

Snyk's `protect` helps you address the known vulnerabilities `snyk test` found. 
To get started, run `protect` in interactive mode:
```shell
snyk protect -i
```

Protect's interactive mode will run `test` again, and ask you what to do for each found issue. Here are the possible remediation steps for each vulnerability:

- `Upgrade` - if upgrading a direct dependency can fix the current vulnerability, `snyk protect` can automatically modify your Package.json file to use the newer version. Note that you'll still need to run `npm update` afterwards to get the new packages.
- `Ignore` - If you believe this vulnerability does not apply to you, or if the dependent module in question never runs on a production system, you can choose to ignore the vulnerability. By default, we will ignore the vulnerability for 30 days, to avoid easily hiding a true issue. If you want to ignore it permanently, you can manually edit the generated `.snyk` file.
- `Patch` - Sometimes there is no direct upgrade that can address the vulnerability, or there is one but you cannot upgrade due to functional reasons (e.g. it's a major breaking change). For such cases, `snyk protect` lets you patch the issue with a patch applied locally to the relevant dependency files. We manually create and maintain these patches, and may not have one for every issue. If you cannot upgrade, patch is often a better option than doing nothing *Note: patch is not yet enabled in the private beta, it will be soon. In the meantime, patch will be replaced with a short ignore*.

Once completed, `snyk protect -i` will create a local `.snyk` file that guides non-interactive executions of `snyk protect`. Note that `snyk protect` will never unilaterally decide to ignore or patch a vulnerability - it will simply follow the guidance captured in the `.snyk` file.

## Integrating Snyk into your dev workflow

To continuously test against and protect from known vulnerabilities, integrate Snyk into your continuous integration (a.k.a. build) system. Here are the steps required to to so:

1. Add `snyk` to your project's dependencies (`npm install -S snyk`), and commit the change in
2. Ensure the `.snyk` file you generated was added to your source control (`git add .snyk`);
3. After the `npm install` steps in your CI, run `snyk protect` to apply any necessary patches
4. Run `snyk test` to identify on any known vulnerabilities not already ignored or patched. If such vulnerabilities were found, `snyk test` will return a non-zero value to fail the test.

A few potential alternatives to consider:
- Add `snyk test` to your Package.json `test` scripts, to capture them in local `npm test` runs. 
- Add `snyk test` as a `post-install` step in your Package.json file, to immediately spot any newly added module which has known vulnerabilities
- Add `snyk protect` as a `post-install` step in your Package.json file, to apply patches even while working locally

Note: During private beta, all snyk actions require authentication. This means modifying your Package.json will require your entire team to first run `snyk auth`. If you don't want that, hold off on modifying your Package.json file for now. 

## monitor

With `test` and `protect`, you're well setup to address currently known vulnerabilities. However, new vulnerabilities are constantly disclosed - which is where `monitor` comes in.

Just before you deploy, run `snyk monitor` in your project directory. This will post a snapshot of your full dependency tree to Snyk's servers, where they will be stored. Those dependencies will be tracked for newly disclosed vulnerabilities, and we will alert you if a new vulnerability related to those dependencies is disclosed.

```shell
# example uses
cd ~/projects/myproject/
snyk monitor
# a snyk.io monitor response URL is returned
```

## More About Authentication

During the private beta, you will need to authenticate with snyk before being able to use any of it's features. Once public, `test` and `protect` will be available without the need to `auth`.

Authentication requires you to have a GitHub account, but *does not require access to your repositories* - we simply use Github to spare you managing another set of credentials. Run `snyk auth` and follow the on screen instructions.

If you are authenticating on a remote machine, for instance on a build server, you can use your API key from https://snyk.io and authenticate directly on the command line using `snyk auth <key>`. Browse to the [Snyk app](https://app.snyk.io/) to find out your own API key.

## Credits

While we use multiple sources to determine vulnerabilities, the primary (current) source is the [Node Security project](http://nodesecurity.io).

## [1.1304.0](https://github.com/snyk/snyk/compare/v1.1303.2...v1.1304.0) (2026-04-08)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **aibom**: Introduces the `snyk aibom test` command. ([2978044](https://github.com/snyk/snyk/commit/297804447be12f47b33f3ed9630a1db0a6994d70))
* **test, monitor, sbom**: Introduce `--maven-skip-wrapper` flag to force the use of a globally installed `mvn` command. ([0ee90ca](https://github.com/snyk/snyk/commit/0ee90caeec58d9a04843dfa9f64b35bc10f543f5), [ff31066](https://github.com/snyk/snyk/commit/ff31066d7f327f4ea25b758108bb62abed3b286a))
* **general**: Introduce explicit configuration for network retry `max-attempts`. ([1fbdf38](https://github.com/snyk/snyk/commit/1fbdf38647c30e29bfc6d6c3612241be9c5b90ca))
* **container**: Add deprecation warnings for `-shaded-jars-depth` and non-numeric values for `--nested-jars-depth`. ([321b6f5](https://github.com/snyk/snyk/commit/321b6f5516ae4f41dfd184911c3bd117c595ea68))
* **mcp**: Improves auto-enable behavior for Snyk Code, promotes package health checks to stable. ([5f5898f](https://github.com/snyk/snyk/commit/5f5898f531ac84c7ee63feb7ab150fa1949373e7))
* **redteam**: Adds a vulnerability summary to scanned output. ([52eaf5a](https://github.com/snyk/snyk/commit/52eaf5afdc93c0d86324972387df8cecba0c6d48))
* **redteam**: Add `--json` flag support for list commands, `exhaustive` and `eager` modes. ([e962c4d](https://github.com/snyk/snyk/commit/e962c4d71cf4e077c7b262c91d69bcf40022d003))


### Bug Fixes

* **general**: Fix printing JSON output on stdout when only `--json-file-output` is specified. ([32f65f0](https://github.com/snyk/snyk/commit/32f65f099b716a216cbe0ad2ce9d8fef4be81704))
* **test**: Fixes an issue where no files were uploaded when using `--skip-unresolved`. ([71ca761](https://github.com/snyk/snyk/commit/71ca761b28ce3b4122c6778791433e46f82dcd29))
* **test**: Prevents scan failures when Maven builds succeed with non-fatal errors. ([b30db97](https://github.com/snyk/snyk/commit/b30db97978ab74e4bb66c1a6095019fae9259939))
* **test**: Fixes Go PackageURL generation and import path normalization for projects using `replace` directives. ([7c7a366](https://github.com/snyk/snyk/commit/7c7a3661a72b6e210aac0c4bd9d6acb2bd7bbd62), [ee7d72b](https://github.com/snyk/snyk/commit/ee7d72bb2c317dc571498e91239c8efb50257744))
* **test**: Improves SDK detection when host and SDK versions differ. ([96d0817](https://github.com/snyk/snyk/commit/96d0817068472ee4a8bb916fb54dd3296f384d7a))
* **test**: Ensures project names are populated when scanning NuGet projects from repository root. ([c043553](https://github.com/snyk/snyk/commit/c0435535a03fc7fcb3b35b671eda54c1f313593f))
* **container**: Snyk Container scans of tar files on Windows should now report vulnerabilities for Python application package files. ([9b86790](https://github.com/snyk/snyk/commit/9b867908c4a89046ee475be26a058dff2301f40d))
* **container**: Override packages with inaccurate pom.properties files ([9b86790](https://github.com/snyk/snyk/commit/9b867908c4a89046ee475be26a058dff2301f40d))
* **test**: Ensure Yarn workspace pacakges matches are actual members defined in the root `package.json`. ([0dd6581](https://github.com/snyk/snyk/commit/0dd6581046148aceb4adedd6d0e70838970c9c84))
* **test**: Fix increased scan times when testing Golang projects. ([f2f5ba2](https://github.com/snyk/snyk/commit/f2f5ba2811d49156016c0ce6ac7d180d40ef1efc))
* **code**: Snyk Code scans now return clearer error message and exit codes when testing unsupported projects ([6f5b4e3](https://github.com/snyk/snyk/commit/6f5b4e3de3e1c2b7359215c7dde24af447a8b3df))
* **test**: Fix a bug where aliased packages were being resolved with the target name insted of the alias for yarn projects. ([dcbec6f](https://github.com/snyk/snyk/commit/dcbec6fb44397bbb1849ecafd0810d1f6b22fcb0))
* **test**: Fix a bug where Python packages with `.` characters in their name were incorrectly parsed to include `-` characters. ([9a2a36e](https://github.com/snyk/snyk/commit/9a2a36e90cd14139735c18b696bd9de50774f0fc))
* **deps**: Updates dependencies to fix vulnerabilities ([8e7873f](https://github.com/snyk/snyk/commit/8e7873ff6e9f852ad57bac4c0024231892754e05), [1a08533](https://github.com/snyk/snyk/commit/1a085335b0f3252818865d3df13e8abba815ffb2), [1321575](https://github.com/snyk/snyk/commit/132157557160f9d60cba22e073925bdcc1b53656), [8ff6aad](https://github.com/snyk/snyk/commit/8ff6aad6423d92cf39aad1de76fedb2cc10b5ef0), [e98d9ef](https://github.com/snyk/snyk/commit/e98d9ef256c6ed21dc452bde7fed03581cc0a6db), [9854eb3](https://github.com/snyk/cli/commit/9854eb3b9c016692e119082f7b592b9236141b21))

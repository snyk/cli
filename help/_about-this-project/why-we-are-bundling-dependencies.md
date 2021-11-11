# Why is Snyk CLI bundling its dependencies?

Snyk CLI is a Node.js application that's distributed as a standalone executable or an [npm/yarn package](https://www.npmjs.com/package/snyk). Snyk CLI relies on many other npm packages, that are defined in the `package.json` manifest.

Over the years we've run into multiple issues and limitations in the npm/yarn ecosystem. These caused a number of issues ranging from annoyances to outright security problems. The root cause for most of those was that npm packages installation does not respect lockfiles that are distributed with the package.

Without a working lockfile, we couldn't control versions of dependencies that are installed with the Snyk CLI. When you ran `npm install snyk --global` on your machine, **you could end up with different and sometimes incompatible versions than those we tested the Snyk CLI with**. Things got even more complicated once you were installing Snyk CLI with a different npm version or yarn command or as a direct dependency into your project.

This forced us to work on making Snyk CLI installations more predictable. We chose to use [Webpack](https://webpack.js.org) to bundle all the JavaScript code from the Snyk CLI, including the dependencies. This means Webpack will pick only the code that's required for the CLI and create a JavaScript **bundle**. This bundle is self-contained. This improved our testing, as we can rely on a single artifact that gets built, regardless of installation method and environment. As a result, when publishing the CLI we don't declare any dependencies in `package.json` as they are already included in the published bundle.

Another major win is a much [smaller distribution and faster Snyk CLI installation](https://updates.snyk.io/smaller-and-faster-cli!-206415). E.g., a Windows npm installation took about 2-3 minutes. After bundling was released it takes a few seconds.

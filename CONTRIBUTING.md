# Contributing

> This guide is for internal Snyk contributors with write access to this repository. If you are an external contributor, before working on any contributions, please first [contact support](https://support.snyk.io) to discuss the issue or feature request with us.

## Prerequisites

You will need the following software installed:

- Git
- Node.js (and bundled npm)
  - Use whichever version is in [`.nvmrc`](./.nvmrc).

Open a terminal and make sure they are available.

```sh
git --version
node --version
npm --version
```

## Setting up

Clone this repository with git.

```sh
git clone git@github.com/snyk/cli.git
cd snyk
```

You will now be on our `master` branch. You should never commit to this branch, but you should keep it up-to-date to ensure you have the latest changes.

```sh
git fetch
git pull --ff-only
```

If you encounter vague errors without a clear solution at any point, try starting over by cloning a new copy or cleaning the project.

```
npm run clean
```

## Building

Install project dependencies.

```sh
npm ci
```

Build the project.

```sh
npm run build
```

Ensure the build is working. The version should be `1.0.0-monorepo`.

```sh
npx . --version
```

For faster rebuilds, you can watch for changes. This command will keep running so you will want to run this in a separate terminal or background.

```
npm run watch
```

## Running tests

You can run tests using standard Jest commands. See: [Jest CLI docs](https://jestjs.io/docs/cli).

```
npx jest --runInBand <path>
```

If you are working on a specific project, you can filter by project.

```
npx jest --runInBand --selectProjects @snyk/protect <path>
```

Debugger configuration is available for VS Code. Open "Run and Debug" and choose "Jest Current File".

Typically, you should not run the full test suite locally. Snyk CLI includes a variety of features which require various tools and configuration to be installed. Our PR pipeline will take care of most of that. Locally, you should focus on the tests related to your changes.

## Writing tests

All tests end in `.spec.ts` and use Jest. There are two types of tests:

- `./test/jest/unit` - Unit tests targeting source code (`./src`).
- `./test/jest/acceptance` - Acceptance tests targeting distributables (`./dist`).

Each test must start from a clean slate to avoid pollution. Do not share state between tests and always perform any setup within the test itself or in specific before and after hooks.

To avoid hard wiring tests to your specific implementation, try writing the test first.

### Unit tests

Unit tests enforce the correctness of our source code. Ensure the path to the test mirrors the path to the source.

Unit tests must be fast. They should not test services outside the code itself. Services include filesystems, processes and networks.

Avoid using mocks as these can go out of sync and be difficult to maintain; prefer interfaces instead.

If you are mostly testing functions calling other functions, consider writing an acceptance test instead. Otherwise, your tests will likely mirror the implementation and rely heavily on mocks; making future changes difficult.

### Acceptance tests

Acceptance tests enforce the correctness of our distribution and are written from the perspective of an user.

Snyk CLI's acceptance tests execute a specific command line as a standalone process, then assert on `stdout`, `stdin` and the exit code. As an example, see: [`oauth-token.spec.ts`](test/jest/acceptance/oauth-token.spec.ts).

Your tests should never call remote endpoints. Otherwise, our release pipelines will require those services to be available. To avoid this, we can assume external services are kept compatible. If any of these services cause issues, we can rely on production monitoring to alert us.

Use [fake-server](./test/acceptance/fake-server.ts) to mock any Snyk API calls. If you are using other endpoints, mock those too in a similar way.

Place fixtures in `./test/fixtures`. Keep them minimal to reduce maintenance. Use [`createProject`](./test/jest/util/createProject.ts) to use your fixtures in isolated working directories for your tests.

### Smoke Tests

Smoke tests typically don't run on branches unless the branch is specifically prefixed with `smoke/`. They usually run on an hourly basis against the latest published version of the CLI.

If you merge a PR that changes smoke tests, remember that the tests will fail until your changes are deployed.

See [the smoke tests readme](./test/smoke/README.md) for more info

## Code ownership

For current ownership assignments, see: [CODEOWNERS](./.github/CODEOWNERS).

To avoid mixing ownership into a single file, move team-specific logic into separate files. To reduce blockers and save time, design with ownership in mind.

## Adding dependencies

When adding and upgrading dependencies, ensure the `package-lock.json` results in minimal updates. To do this you can:

```
npm ci
npm install <your dependency>
```

It's best to avoid adding external dependencies. All dependency changes are reviewed by Hammer.

## Code formatting

To ensure your changes follow formatting guidelines, you can run the linter.

```
npm run lint
```

To fix various issues automatically you can install ESLint and Prettier plugins for your IDE or run the following:

```
npm run format
```

You will need to fix any remaining issues manually.

## Updating documentation

When making changes, ensure documentation is updated accordingly.

User-facing documentation is [available on GitBook](https://docs.snyk.io/features/snyk-cli).

`snyk help` output must also be [edited on GitBook](https://docs.snyk.io/features/snyk-cli/commands). Changes will automatically be pulled into Snyk CLI as pull requests.

## Creating a branch

Create a new branch before making any changes. Make sure to give it a descriptive name so that you can find it later.

```sh
git checkout -b type/topic
```

For example:

```sh
git checkout -b docs/contributing
```

### Branch types

You can use these patterns in your branch name to enable additional checks.

| Pattern             | Examples                                          | Description                                                                                                                |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `chore/*`, `*test*` | `chore/change`, `test/change`, `feat/change+test` | Build and test all artifacts, excluding CLIv2. Same as a [release pipeline](#creating-a-release) without the release step. |
| `smoke/*`           | `smoke/change`                                    | Run [smoke tests](https://github.com/snyk/cli/actions/workflows/smoke-tests.yml) against the latest release.               |
| `*cliv2*`           | `feat/cliv2-feature`                              | Build and test all artifacts, including CLIv2.                                                                             |
| default             | `fix/a-bug`                                       | Build and test your changes.                                                                                               |

For more information, see: [Pull request checks](#pull-request-checks).

## Creating commits

Each commit must provide some benefit on its own without breaking the release pipeline.

For larger changes, break down each step into multiple commits so that it's easy to review in pull requests and git history.

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) structure:

```
type: summary of your changes

reasoning behind your changes
```

For example:

```
docs: update contributing guide

We often get questions on how to contribute to this repo. What versions to use, what the workflow is, and so on. This change updates our CONTRIBUTING guide to answer those types of questions.
```

### No breaking changes

Your changes must be backwards compatible and cannot break existing user pipelines.

Don't use `BREAKING CHANGE` or exclamation mark `!` from the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Commit types

The commit type is used to summarize intent and to automate various steps.

| Type       | Description                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | A new user-facing feature.                      |
| `fix`      | A bug fix for an existing feature.              |
| `refactor` | Changes which do not affect existing features.  |
| `test`     | Changes to tests for existing features.         |
| `docs`     | Changes to documentation for existing features. |
| `chore`    | Build, workflow and pipeline changes.           |
| `revert`   | Reverting a previous commit.                    |

## Pushing changes

Once you have committed your changes, review them locally, then push them to GitHub.

```
git push
```

Do not hold onto your changes for too long. Commit and push frequently and create a pull request as soon as possible for backup and visibility.

## Creating pull requests

You can now [create a Draft PR](https://github.com/snyk/cli/compare) on GitHub. Make sure to switch the big green button to a "Draft Pull Request". Draft PRs allow you to ensure your PR checks pass before asking for a review.

To keep things simple, try to use the most important commit as the PR's title. Provide some context and summarize the changes in your body.

If your PR becomes too large, consider breaking it up into multiple PRs so that it's easier to explain, review, and integrate.

## Pull request checks

Your PR checks will run every time you push changes to your branch.

| Name               | Failure action                                                        |
| ------------------ | --------------------------------------------------------------------- |
| `test_and_release` | See: [Test pipeline](#test-pipeline).                                 |
| `Danger`           | Check the comment created on your PR.                                 |
| `license/cla`      | Visit [CLA Assistant](https://cla-assistant.io) to sign or re-run it. |
| Everything else.   | Ask Hammer.                                                           |

### Test pipeline

The [test pipeline](https://app.circleci.com/pipelines/github/snyk/cli?filter=mine) is on CircleCI. This is where your changes are built and tested.

If any checks fail, fix them and force push your changes again. Make sure to review and tidy up your branch so that it remains easy to follow.

Some tests may "flake", meaning they failed due to some external factor. While we try to fix these tests immediately, that's not always possible. You can use CircleCI's "Re-run from Failed" option to re-run only that job without needing to re-run the entire pipeline.

## Review cycle

Once your checks have passed, you can publish your Draft PR. Codeowners will be automatically assigned. Ask each codeowner for a review using relevant channels on Slack. Iterate on feedback.

Once you have received the necessary approvals, you can merge.

## Creating a release

Merges will create a [release pipeline](https://app.circleci.com/pipelines/github/snyk/cli?branch=master&filter=all) which will build and test your changes against a range of target platforms.

Once all tests have passed, you will be given the choice to publish a new release containing your changes.

All releases are minor version bumps. For the latest releases, see: [Releases](https://github.com/snyk/cli/releases).

If you do not want to publish your changes immediately, you can "Cancel Workflow".

If your release pipeline fails at any step, notify Hammer.

You may see some "Docker Hub" checks on your merge commit fail. This is normal and safe to ignore.

---

Questions? Ask Hammer 🔨

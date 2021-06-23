# Contributing

## Contributor Agreement

A pull-request will only be considered for merging into the upstream codebase after you have signed our [contributor agreement](https://github.com/snyk/snyk/blob/master/Contributor-Agreement.md), assigning us the rights to the contributed code and granting you a license to use it in return. If you submit a pull request, you will be prompted to review and sign the agreement with one click (we use [CLA assistant](https://cla-assistant.io/)).

## Making Changes

- Add tests for newly added code.
  - Write new test suites in Jest. Depending on the type of test, place them in either `./test/jest/unit` or `./test/jest/acceptance`.
  - Try to mirror directory and file structure if possible.
  - Use the automated checks on your PR to make sure it works on different platforms and versions.
- Ensure that your code adheres to the project's ESLint and Prettier configuration.
  - You can check by using `npm run lint` and `npm run format` respectively.
- Avoid making any breaking changes. Preserve existing functionality. If you really need to, discuss it with us beforehand.
- New command line options are discouraged. If you really need one, please discuss it with us beforehand.

## Commit Messages

Commit messages must follow the [Angular-style](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#commit-message-format) commit format.

i.e:

```text
fix: minified scripts being removed

Also added a test to ensure these scripts exist after a build.
```

This will allow for the automatic changelog to generate correctly.

### Commit Types

Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **test**: Adding missing tests
* **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **perf**: A code change that improves performance

To release a major you need to add `BREAKING CHANGE: ` to the start of the body and the detail of the breaking change. But again, avoid making any breaking changes.

## Sending Pull Requests

- If the PR is not ready for review, create a Draft PR.
- Proof-read your changes.
  - Make sure there aren't any spelling or typing errors.
  - Remove irrelevant changes like formatting an unrelated file.
- Clearly explain your reasoning behind each change, provide context using links and documentation where needed.
- PRs will not be reviewed unless all tests are passing.

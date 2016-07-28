## Commit message format

We follow the [angular style of commit](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#commit) messages, with the exception that the scope is not required.

This is important as we use [semantic release](https://github.com/semantic-release/semantic-release) to fully automate the release process (note that this is already configured on all our repositories).

```text
<type>: <subject>
<BLANK LINE>
<body>
```

Don't overshoot the 50 character limit in the subject line - this includes the type prefix.

### Commit types

Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **test**: Adding missing tests
* **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **perf**: A code change that improves performance

To release a major you need to add `BREAKING CHANGE: ` to the start of the body and the detail of the breaking change.

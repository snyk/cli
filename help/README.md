# CLI Help files

Snyk CLI Help files are managed by GitBook connected to the [snyk/user-docs](https://github.com/snyk/user-docs)
repository.

It's recommended to make all CLI Help changes there, as changes here will be overwritten by the next sync.

Changes from GitBook are automatically synced to the Snyk CLI repository with GitHub Actions:

- https://github.com/snyk/snyk/actions/workflows/sync-cli-help-to-user-docs.yml and
- https://github.com/snyk/snyk/actions/workflows/sync-cli-readme.yml

The actions create PRs that need to be approved and merged. This action could also be manually triggered.

If you need to make changes tied to a specific PR, you can make them in this repository first, merge the changes and
then move them over to the GitBook.

CLI help files are a standard Markdown.

# File Ignore Rules Fixture

This fixture aims to test Snyk Code file filtering logic, based on the various file ignore rules it supports (currently `.gitignore`, `.dcignore`, `.snyk`).

More details on Snyk Code ignore rules can be found in the Snyk Code documentation [here](https://docs.snyk.io/scan-with-snyk/snyk-code#overview) and [here](https://docs.snyk.io/scan-with-snyk/import-project-repository/exclude-directories-and-files-from-project-import).


## .gitignore testing
Due to the nature of how `.gitignore` works, we must create the filestructure of the fixture at test time. Setup/teardown is done by calling the `createFilepaths` and `deleteFilepaths` functions in `test/jest/util/fileIgnoreRulesFixture.ts`.

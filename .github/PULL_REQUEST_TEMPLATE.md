## Pull Request Submission

Please check the boxes once done.

The pull request must:

- **Reviewer Documentation**
    - [ ] follow [CONTRIBUTING](https://github.com/snyk/cli/blob/main/CONTRIBUTING.md) rules
    - [ ] be accompanied by a detailed description of the changes
    - [ ] contain a risk assessment of the change (Low | Medium | High) with regards to breaking existing functionality. A change e.g. of an underlying language plugin can completely break the functionality for that language, but appearing as only a version change in the dependencies.
    - [ ] highlight breaking API if applicable
    - [ ] contain a link to the automatic tests that cover the updated functionality.
    - [ ] contain testing instructions in case that the reviewer wants to manual verify as well, to add to the manual testing done by the author.
    - [ ] link to the link to the PR for the User-facing documentation
- **User facing Documentation**
    - [ ] update any relevant documentation in gitbook by submitting a gitbook PR, and including the PR link here
    - [ ] ensure that the message of the final single commit is descriptive and prefixed with either `feat:` or `fix:` , others might be used in rare occasions as well, if there is no need to document the changes in the release notes. The changes or fixes should be described in detail in the commit message for the changelog & release notes.
- **Testing**
    - [ ] Changes, removals and additions to functionality must be covered by acceptance / integration tests or smoke tests - either already existing ones, or new ones, created by the author of the PR.

## Pull Request Review

All pull requests must undergo a thorough review process before being merged. 
The review process of the code PR should include code review, testing, and any necessary feedback or revisions. 
Pull request reviews of functionality developed in other teams only review the given documentation and test reports. 

Manual testing will not be performed by the reviewing team, and is the responsibility of the author of the PR.

For Node projects: It’s important to make sure changes in `package.json` are also affecting `package-lock.json` correctly.

****************************If a dependency is not necessary, don’t add it.**************************** 

When adding a new package as a dependency, make sure that the change is absolutely necessary. We would like to refrain from adding new dependencies when possible.
Documentation PRs in gitbook are reviewed by Snyk's content team. They will also advise on the best phrasing and structuring if needed.

## Pull Request Approval

Once a pull request has been reviewed and all necessary revisions have been made, it is approved for merging into 
the main codebase. The merging of the code PR is performed by the code owners, the merging of the documentation PR 
by our content writers.


## What does this PR do?


## Where should the reviewer start?


## How should this be manually tested?


## Any background context you want to provide?


## What are the relevant tickets?


## Screenshots


## Additional questions

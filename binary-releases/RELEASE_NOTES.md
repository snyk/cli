## [1.1306.2](https://github.com/snyk/snyk/compare/v1.1306.1...v1.1306.2) (2026-07-27)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their
needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **language-server**: Various Snyk Language Server fixes: login requests are now cancelled when you change authentication method, start a new login, or log out; the IDE settings page stays available when authentication fails at startup; and the limited settings page now offers a log out action. ([3afb07a](https://github.com/snyk/cli/commit/3afb07a2866728cedf71c8b35dcab6838a2e0b17))
* **deps**: Updates dependencies to fix vulnerabilities:
    - SNYK-GOLANG-GOOGLEGOLANGORGGRPCINTERNALXDSRBAC-18172577 ([11d1660](https://github.com/snyk/cli/commit/11d1660d55d55514ed24d232ef9418f9c858cb25))
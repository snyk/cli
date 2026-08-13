## [1.1306.4](https://github.com/snyk/snyk/compare/v1.1306.3...v1.1306.4) (2026-08-13)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their
needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **general**: Clearer error messages when the CLI cannot reach a configured proxy, including the proxy URL and a specific error code (SNYK-CLI-0028). ([a5ebf60](https://github.com/snyk/cli/commit/a5ebf60c2b67c6318d1b11d782f52f416cd4cd19))
* **deps**: Updates dependencies to fix vulnerabilities:
    - SNYK-JS-JSYAML-18593780 ([d049816](https://github.com/snyk/cli/commit/d049816a6b8fa20c18aba112080f0c5dacf97260))
    - Updates the embedded Node.js runtime from 22.22.2 to 22.23.2 and OpenSSL from 3.5.5 to 3.5.7, including fixes for six high-severity CVEs: CVE-2026-45447, CVE-2026-48618, CVE-2026-48933, CVE-2026-56846, CVE-2026-56848, and CVE-2026-58043, plus additional OpenSSL security fixes. ([bcf5fec](https://github.com/snyk/cli/commit/bcf5fec51a135aa69c7892d6638f2f08013b420c))

## [1.1292.2](https://github.com/snyk/snyk/compare/v1.1292.1...v1.1292.2) (2024-08-01)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

## Complete changelog

### Bug Fixes

- **container test:** Improve the accuracy of identifying npm projects within docker images by removing the explicit folder ignore rules
  ([#5384](https://github.com/snyk/snyk/issues/5384))
- **container test:** Pass platform parameter when pulling an image from a container registry ([#5360](https://github.com/snyk/snyk/issues/5360))

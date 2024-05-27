'use strict';
const config = require('conventional-changelog-conventionalcommits');

const headerExtension = `
The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)`;

module.exports = config({}).then((preset) => {
  preset.conventionalChangelog.writerOpts.headerPartial += headerExtension;
  return preset;
});

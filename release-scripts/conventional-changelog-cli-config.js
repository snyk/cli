'use strict';
const config = require('conventional-changelog-conventionalcommits');
const { execFileSync } = require('child_process');
const semver = require('semver');

// Preview/rc tags (vX.Y.Z-preview.<sha>) exist in the history of main. The release notes must
// cover everything since the last *stable* release, so start from the nearest stable tag
// instead of the nearest tag of any kind.
function latestReachableStableTag() {
  try {
    return execFileSync(
      'git',
      [
        'describe',
        '--tags',
        '--abbrev=0',
        '--match',
        'v[0-9]*.[0-9]*.[0-9]*',
        '--exclude',
        'v*-*',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch (_) {
    return undefined;
  }
}

const headerExtension = `
The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)`;

module.exports = config({}).then((preset) => {
  preset.conventionalChangelog.writerOpts.headerPartial += headerExtension;
  // a preview/rc tag must not start a new section of the release notes
  preset.conventionalChangelog.writerOpts.generateOn = (commit) =>
    semver.valid(commit.version) && !semver.prerelease(commit.version);
  const from = latestReachableStableTag();
  if (from) {
    preset.gitRawCommitsOpts = { ...preset.gitRawCommitsOpts, from };
    preset.context = { ...preset.context, previousTag: from };
  }
  return preset;
});

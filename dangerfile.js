const {danger, warn, fail, message} = require('danger');

if (danger.github && danger.github.pr) {
  const commitizenRegex = /^(feat|fix|chore|test|docs|perf|refactor|revert)(\(.*\))?:(.+)$/;
  const ghCommits = danger.github.commits;
  let willTriggerRelease = false;
  for (const {commit} of ghCommits) {
    const {message, url} = commit;
    const firstLine = message.split('\n')[0];

    if (message.startsWith('feat') || message.startsWith('fix')) {
      willTriggerRelease = true;
    }

    const regexMatch = commitizenRegex.exec(firstLine);
    if (!regexMatch) {
      fail(`Commit ["${firstLine}"](${url}) is not a valid commitizen message. See [Contributing page](https://github.com/snyk/snyk/blob/master/.github/CONTRIBUTING.md#commit-types) with required commit message format.`);
    }

    if (firstLine.length >= 72) {
      warn(`Your commit message ["${firstLine}"](${url}) is too long. Keep first line of your commit under 72 characters.`);
    }
  }

  if (!willTriggerRelease) {
    message('This PR will not trigger a new version. It doesn\'t include any commit message with `feat` or `fix`.');
  }
}

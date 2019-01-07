const fs = require('fs');
const config = require('./config');

const suggestionText =
  '\n\nWe noticed that there is a Dockerfile in the current directory.' +
  '\nConsider using Snyk to scan your docker images.' +
  '\n\nExample: $ snyk test --docker <image> --file=Dockerfile' +
  '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`';


module.exports = {
  shouldSuggestDocker: shouldSuggestDocker,
  suggestionText: suggestionText,
};

function shouldSuggestDocker(options) {
  const dateToStopDockerPromotion = new Date('2019-01-01');

  try {
    return (!options.docker &&
      fs.existsSync('Dockerfile') &&
      (config.disableSuggestions !== 'true') &&
      (Date.now() < dateToStopDockerPromotion));
  } catch (e) {
    return false;
  }
}

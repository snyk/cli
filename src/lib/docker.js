var fs = require('fs');
var config = require('./config');

function shouldSuggestDocker(options) {
  const dateToStopDockerPromotion = new Date('2019-01-01');

  return (!options.docker &&
      fs.existsSync('Dockerfile') &&
      (!config.disableSuggestions || config.disableSuggestions !== 'true') &&
      Date.now() < dateToStopDockerPromotion);
}

const suggestionText =
  '\n\nPro tip: We noticed that there is a Dockerfile in the current directory.' +
  '\nConsider using `--docker` to scan your docker images.' +
  '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`';


module.exports = {
  shouldSuggestDocker: shouldSuggestDocker,
  suggestionText: suggestionText,
};

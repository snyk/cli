var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var tryGetSpec = require('./try-get-spec');
var pattern = /^Gemfile(\.lock)*$/;

module.exports = {
  canHandle: function handles(file) {
    return file && pattern.test(path.basename(file));
  },

  gatherSpecs: function gatherSpecs(root, target) {
    var targetName = path.basename(target);
    var targetDir = path.dirname(target);
    var files = {};

    var gemfileLock = tryGetSpec(root, path.join(targetDir, 'Gemfile.lock'));
    if (gemfileLock) {
      files.gemfileLock = gemfileLock;
    } else {
      throw new Error('Missing Gemfile.lock file: we can\'t test ' +
      'without dependencies.\nPlease run `bundle install` first.');
    }

    var gemfile = tryGetSpec(root, path.join(targetDir, 'Gemfile'));
    if (gemfile) {
      files.gemfile = gemfile;
    }

    return Promise.resolve({
      packageName: path.basename(root),
      targetFile: path.join(targetDir, targetName),
      files: files,
    });
  },
};

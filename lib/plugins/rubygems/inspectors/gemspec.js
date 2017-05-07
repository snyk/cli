var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var tryGetSpec = require('./try-get-spec');
var pattern = /\.gemspec$/;

module.exports = {
  canHandle: function handles(file) {
    return file && pattern.test(file);
  },

  gatherSpecs: function gatherSpecs(root, target) {
    var targetName = path.basename(target);
    var targetDir = path.dirname(target);
    var files = {};

    var gemspec = tryGetSpec(root, path.join(targetDir, targetName));
    if (gemspec) {
      files.gemspec = gemspec;
    } else {
      throw 'File not found: ' + target;
    }

    var gemfileLock = tryGetSpec(root, path.join(targetDir, 'Gemfile.lock'));
    if (gemfileLock) {
      files.gemfileLock = gemfileLock;
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

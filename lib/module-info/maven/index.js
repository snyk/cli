var Promise = require('es6-promise').Promise; // jshint ignore:line
var parse = require('./mvn-tree-parse');
var fs = require('fs');
var path = require('path');
var subProcess = require('../../sub-process');

module.exports = function (root, targetFile, policy, mavenArgs) {
  return subProcess.execute('mvn',
    buildArgs(root, targetFile, mavenArgs),
    { cwd: root })
  .then(function (result) {
    return parse(result.stdout);
  });
};

function buildArgs(root, targetFile, mavenArgs) {
  // Requires Maven >= 2.2
  var args = ['dependency:tree', '-DoutputType=dot'];
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    args.push('--file=' + targetFile);
  }
  if (mavenArgs) {
    args.push(mavenArgs);
  }
  return args;
}

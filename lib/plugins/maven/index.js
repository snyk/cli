var Promise = require('es6-promise').Promise; // jshint ignore:line
var parse = require('./mvn-tree-parse');
var fs = require('fs');
var path = require('path');
var subProcess = require('../../sub-process');

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, mavenArgs) {
  return subProcess.execute(
    'mvn',
    buildArgs(root, targetFile, mavenArgs),
    { cwd: root }
  )
  .then(function (result) {
    return {
      plugin: {
        name: 'bundled:maven',
        runtime: 'unknown',
      },
      package: parse(result),
    };
  });
}

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

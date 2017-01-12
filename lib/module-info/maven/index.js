var Promise = require('es6-promise').Promise; // jshint ignore:line
var childProcess = require('child_process');
var parse = require('./mvn-tree-parse');
var fs = require('fs');
var path = require('path');

module.exports = function (root, targetFile, policy) {
  return new Promise(function (resolve, reject) {
    var command = buildCommand(root, targetFile);
    childProcess.exec(command, { cwd: root }, function (err, stdout, stderr) {
      if (err) {
        return reject(err);
      }
      var result = parse(stdout);
      resolve(result);
    });
  });
};

function buildCommand(root, targetFile) {
  // Requires Maven >= 2.2
  var command = 'mvn dependency:tree -DoutputType=dot';

  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    command = command + ' --file=' + targetFile;
  }

  return command;
}

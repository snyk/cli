var path = require('path');
var subProcess = require('../../sub-process');
var parse = require('./sbt-deps-parse');
var packageFormatVersion = 'mvn:0.0.1';

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, sbtArgs) {
  return subProcess.execute('sbt',
    buildArgs(root, targetFile, sbtArgs),
    { cwd: root })
  .then(function (result) {
    var packageName = path.basename(root);
    var packageVersion = '0.0.0';
    var depTree = parse(result, packageName, packageVersion);
    depTree.packageFormatVersion = packageFormatVersion;

    return {
      plugin: {
        name: 'bundled:sbt',
        runtime: 'unknown',
      },
      package: depTree,
    };
  });
}

function buildArgs(root, targetFile, sbtArgs) {
  var args = ['dependency-tree'];
  if (sbtArgs) {
    args.push(sbtArgs);
  }
  return args;
}

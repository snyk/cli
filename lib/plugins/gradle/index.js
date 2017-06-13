var fs = require('fs');
var path = require('path');
var subProcess = require('../../sub-process');
var parse = require('./gradle-deps-parse');
var packageFormatVersion = 'mvn:0.0.1';

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, gradleArgs) {
  return subProcess.execute('gradle',
    buildArgs(root, targetFile, gradleArgs),
    { cwd: root })
  .then(function (result) {
    var packageName = path.basename(root);
    var packageVersion = '0.0.0';
    var from = packageName + '@' + packageVersion;
    var depTree = parse(result, from);

    return {
      plugin: {
        name: 'bundled:gradle',
        runtime: 'unknown',
      },
      package: {
        dependencies: depTree,
        name: packageName,
        version: packageVersion,
        packageFormatVersion: packageFormatVersion,
        from: [from],
      },
    };
  });
}

function buildArgs(root, targetFile, gradleArgs) {
  var args = ['dependencies', '-q'];
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    args.push('--build-file ' + targetFile);
  }
  if (gradleArgs) {
    args.push(gradleArgs);
  }
  return args;
}

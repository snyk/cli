var repoInspectors = require('./inspectors');

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile) {
  return gatherSpecs(root, targetFile)
  .then(function (specs) {
    var pkg = {
      name: specs.packageName,
      targetFile: specs.targetFile,
      files: specs.files,
    };
    return {
      plugin: {
        name: 'bundled:rubygems',
        runtime: 'unknown',
      },
      package: pkg,
    };
  });
}

function gatherSpecs(root, targetFile) {
  for (var i = repoInspectors.length - 1; i >= 0; i--) {
    var inspector = repoInspectors[i];
    if (inspector.canHandle(targetFile)) {
      return inspector.gatherSpecs(root, targetFile);
    }
  }
  throw new Error('Could not handle file: ' + targetFile);
}

module.exports = getModuleInfo;

var repoInspectors = require('./inspectors');

function getModuleInfo(root, targetFile, policy) {
  return gatherSpecs(root, targetFile)
  .then(function (specs) {
    var body = {
      name: specs.packageName,
      targetFile: specs.targetFile,
      files: specs.files,
    };
    if (policy) {
      body.policy = policy.toString();
    }
    return body;
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

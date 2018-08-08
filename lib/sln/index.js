var fs = require('fs');
var path = require('path');
var debug = require('debug')('snyk');
var detect = require('../detect');

var sln = {};

sln.updateArgs = function (args) {
  // save the path if --file=path/file.sln
  var slnFilePath = path.dirname(args.options.file);

  // extract all referenced projects from solution
  // keep only those that contain relevant manifest files
  var projectFolders = sln.parsePathsFromSln(args.options.file)
    .map(function (projectPath) {
      var projectFolder =
        path.resolve(slnFilePath, path.dirname(projectPath));
      var manifestFile = detect.detectPackageFile(projectFolder);
      return manifestFile ? projectFolder : undefined;
    })
    .filter(Boolean);

  debug('valid project folders in solution: ', projectFolders);

  if (projectFolders.length === 0) {
    throw new Error('No relevant projects found in Solution');
  }

  // delete the file option as the solution has now been parsed
  delete (args.options.file);

  // mutates args!
  addProjectFoldersToArgs(args, projectFolders);
};

// slnFile should exist.
// returns array of project paths (path/to/manifest.file)
sln.parsePathsFromSln = function (slnFile) {
  // read project scopes from solution file
  // [\s\S] is like ., but with newlines!
  // *? means grab the shortest match
  var projectScopes =
    loadFile(path.resolve(slnFile)).match(/Project[\s\S]*?EndProject/g) || [];

  var paths = projectScopes.map(function (projectScope) {
    var secondArg = projectScope.split(',')[1];
    // expected ` "path/to/manifest.file"`, clean it up
    return secondArg && secondArg.trim().replace(/\"/g, '');
  })
    // drop falsey values
    .filter(Boolean)
    // convert path separators
    .map(function (projectPath) {
      return projectPath.replace(/\\/g, path.sep);
    });

  debug('extracted paths from solution file: ', paths);
  return paths;
};

function addProjectFoldersToArgs(args, projectFolders) {
  // keep the last arg (options) aside for later use
  var lastArg = args.options._.pop();
  // add relevant project paths as if they were given as a runtime path args
  args.options._ = args.options._.concat(projectFolders);
  // bring back the last (options) arg
  args.options._.push(lastArg);
}

function loadFile(filePath) {
  // fs.existsSync doesn't throw an exception; no need for try
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = sln;

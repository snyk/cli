var fs = require('fs');
var path = require('path');

var sln = {};

sln.updateArgs = function (args) {
  var slnOptionsFile = args.options.file;
  // save the path if --file=path/file.sln
  var optionalPath = path.dirname(slnOptionsFile);
  var csprojsFound = sln.parseFoldersFromSln(slnOptionsFile);
  delete(args.options.file);
  var lastArg = args.options._.pop();
  csprojsFound.forEach(function (csprojFile) {
    var argToAdd = path.resolve(optionalPath, path.dirname(csprojFile));
    args.options._.push(argToAdd);
  });
  args.options._.push(lastArg);
};

// slnFile should exist.
// returns array of folder names
sln.parseFoldersFromSln = function (slnFile) {
  var csprojFolders = [];
  var slnFileContent = loadFile(path.resolve(slnFile));
  // do a global search for all .csproj files in sln
  var csprojs = slnFileContent.match(/\"[^\"]+\.csproj/g);
  if (csprojs) {
    csprojs.forEach(function (csprojFilename) {
      // convert to forward slashes if needed
      csprojFolders.push(csprojFilename.substr(1).replace(/\\/g, '/'));
    });
  }
  return csprojFolders;
};

function loadFile(filePath) {
  // fs.existsSync doesn't throw an exception; no need for try
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = sln;

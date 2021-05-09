import * as fs from 'fs';
import * as path from 'path';
import * as detect from '../detect';
import { NoSupportedManifestsFoundError } from '../errors/no-supported-manifests-found';
import { FileFlagBadInputError } from '../errors';

const util = require('util');
const debug = util.debuglog('snyk');

// slnFile should exist.
// returns array of project paths (path/to/manifest.file)
export const parsePathsFromSln = (slnFile) => {
  // read project scopes from solution file
  // [\s\S] is like ., but with newlines!
  // *? means grab the shortest match
  const projectScopes =
    loadFile(path.resolve(slnFile)).match(/Project[\s\S]*?EndProject/g) || [];

  const paths = projectScopes
    .map((projectScope) => {
      const secondArg = projectScope.split(',')[1];
      // expected ` "path/to/manifest.file"`, clean it up
      return secondArg && secondArg.trim().replace(/"/g, '');
    })
    // drop falsey values
    .filter(Boolean)
    // convert path separators
    .map((projectPath) => {
      return path.dirname(projectPath.replace(/\\/g, path.sep));
    });

  debug('extracted paths from solution file: ', paths);
  return paths;
};

export const updateArgs = (args) => {
  if (!args.options.file || typeof args.options.file !== 'string') {
    throw new FileFlagBadInputError();
  }

  // save the path if --file=path/file.sln
  const slnFilePath = path.dirname(args.options.file);

  // extract all referenced projects from solution
  // keep only those that contain relevant manifest files
  const projectFolders = parsePathsFromSln(args.options.file);

  const foldersWithSupportedProjects = projectFolders
    .map((projectPath) => {
      const projectFolder = path.resolve(slnFilePath, projectPath);
      const manifestFile = detect.detectPackageFile(projectFolder);
      return manifestFile ? projectFolder : undefined;
    })
    .filter(Boolean);

  debug('valid project folders in solution: ', projectFolders);

  if (foldersWithSupportedProjects.length === 0) {
    throw NoSupportedManifestsFoundError([...projectFolders]);
  }

  // delete the file option as the solution has now been parsed
  delete args.options.file;

  // mutates args!
  addProjectFoldersToArgs(args, foldersWithSupportedProjects);
};

function addProjectFoldersToArgs(args, projectFolders) {
  // keep the last arg (options) aside for later use
  const lastArg = args.options._.pop();
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

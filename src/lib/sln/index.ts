import * as fs from 'fs';
import * as path from 'path';
import * as detect from '../detect';
import { NoSupportedManifestsFoundError } from '../errors/no-supported-manifests-found';
import * as Debug from 'debug';
import { FileFlagBadInputError } from '../errors';

const debug = Debug('snyk');

// The two .NET solution formats. `.slnx` is the XML replacement for the text
// `.sln`: the .NET SDK reads it from 9.0.200, and `dotnet new sln` creates it by
// default from .NET 10.
const SLN_EXTENSION = '.sln';
const SLNX_EXTENSION = '.slnx';

// Returns the solution extension `file` ends with, lower-cased, or '' when it is
// not a solution file. Matched on the suffix rather than with path.extname,
// which reports no extension at all for a name that is only an extension
// (`.slnx`) and would send it to the wrong parser. Lower-casing also keeps the
// message this feeds identical to the one cli-extension-os-flows produces.
export const solutionExtension = (file: string): string => {
  const lowerCased = file.toLowerCase();

  if (lowerCased.endsWith(SLNX_EXTENSION)) {
    return SLNX_EXTENSION;
  }
  if (lowerCased.endsWith(SLN_EXTENSION)) {
    return SLN_EXTENSION;
  }

  return '';
};

export const isSolutionFile = (file: string): boolean =>
  solutionExtension(file) !== '';

// slnFile should exist.
// returns array of project paths (path/to/manifest.file)
export const parsePathsFromSln = (slnFile) => {
  const contents = loadFile(path.resolve(slnFile));

  // Each format reduces a project path to its folder its own way; they do not
  // agree, and `.sln` has to keep behaving exactly as it always has.
  const paths =
    solutionExtension(slnFile) === SLNX_EXTENSION
      ? parseProjectPathsFromSlnx(contents).map(slnxProjectFolder)
      : parseProjectPathsFromSln(contents).map(slnProjectFolder);

  debug('extracted paths from solution file: ', paths);
  return paths;
};

// The original text format: `Project(...) = "Name", "path\to\project.csproj", "{guid}"`.
function parseProjectPathsFromSln(contents: string): string[] {
  // read project scopes from solution file
  // [\s\S] is like ., but with newlines!
  // *? means grab the shortest match
  const projectScopes = contents.match(/Project[\s\S]*?EndProject/g) || [];

  return (
    projectScopes
      .map((projectScope) => {
        const secondArg = projectScope.split(',')[1];
        // expected ` "path/to/manifest.file"`, clean it up
        return secondArg && secondArg.trim().replace(/"/g, '');
      })
      // drop falsey values
      .filter(Boolean)
  );
}

// `.slnx` is XML: a <Solution> of <Project Path="..." /> elements, which may be
// nested inside <Folder> elements to any depth. All we need out of it is the
// project paths, so we match the Project elements rather than pull an XML parser
// into the CLI's dependency tree. Comments are stripped first so a commented-out
// project isn't scanned.
function parseProjectPathsFromSlnx(contents: string): string[] {
  const projectElements =
    contents.replace(/<!--[\s\S]*?-->/g, '').match(/<Project\b[^>]*>/g) || [];

  return projectElements
    .map((element) => {
      const attribute = element.match(/\sPath\s*=\s*("([^"]*)"|'([^']*)')/);
      // one of the two capture groups holds the value; which one depends on the
      // quote style the author used
      return attribute && (attribute[2] ?? attribute[3]);
    })
    .filter(Boolean)
    .map(decodeXmlEntities);
}

function decodeXmlEntities(value: string): string {
  return (
    value
      // Numeric character references first. `&#47;` is a path separator, so
      // leaving these encoded doesn't just misname a folder, it collapses the
      // path to the solution's own directory.
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, decimal) =>
        String.fromCodePoint(parseInt(decimal, 10)),
      )
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Ampersand last, so `&amp;#47;` decodes to the literal text `&#47;`
      // rather than to a separator.
      .replace(/&amp;/g, '&')
  );
}

function toOsSeparators(projectPath: string): string {
  return projectPath.replace(/\\/g, path.sep);
}

// Unchanged from before `.slnx` existed, deliberately. An ASP.NET Website
// project is written with a trailing separator (`..\WebSites\Site1\`) and has
// always resolved to the folder *above* it. That may well be wrong, but it
// decides which projects a `.sln` scan covers, so correcting it belongs in its
// own change with its own release note — not smuggled in with a new format.
function slnProjectFolder(projectPath: string): string {
  return path.dirname(toOsSeparators(projectPath));
}

// A `.slnx` project path normally names the project file, whose folder holds the
// manifest. A path written with a trailing separator names a folder instead —
// that is how an ASP.NET Website project is recorded, which has no project file
// at all — so the folder itself is what gets scanned.
function slnxProjectFolder(projectPath: string): string {
  const normalised = toOsSeparators(projectPath);

  return /[\\/]$/.test(projectPath)
    ? normalised.slice(0, -1)
    : path.dirname(normalised);
}

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

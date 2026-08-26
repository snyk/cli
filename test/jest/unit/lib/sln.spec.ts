import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sln from '../../../../src/lib/sln';
import { getWorkspacePath } from '../../util/getWorkspacePath';

const basenames = (paths: string[]) => paths.map((p) => path.basename(p));

// For solution contents that only need to be parsed, not scanned — no project
// folders have to exist on disk.
const writeTempSolution = (contents: string): string => {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-slnx-')),
    'mySolution.slnx',
  );
  fs.writeFileSync(file, contents);

  return file;
};

// The extension decides three things: whether --file is a solution at all,
// which parser reads it, and which extension the unsupported-combination error
// names. cli-extension-os-flows produces that same message from its own
// suffix match, so this has to agree with it — including on case.
describe('solutionExtension', () => {
  it.each([
    ['mySolution.sln', '.sln'],
    ['mySolution.slnx', '.slnx'],
    ['MYSOLUTION.SLNX', '.slnx'],
    ['mySolution.SlNx', '.slnx'],
    ['path/to/mySolution.slnx', '.slnx'],
    // Only an extension, so path.extname reports nothing — it would send this
    // to the text parser.
    ['.slnx', '.slnx'],
    ['.sln', '.sln'],
    ['mySolution.slnf', ''],
    ['myProject.csproj', ''],
    ['slnx', ''],
    ['dir.slnx/myProject.csproj', ''],
  ])('%s -> "%s"', (file, expected) => {
    expect(sln.solutionExtension(file)).toBe(expected);
    expect(sln.isSolutionFile(file)).toBe(expected !== '');
  });
});

// An ASP.NET Website project is written into a `.sln` with a trailing
// separator, and has always resolved to the folder above it. Adding `.slnx`
// must not change which folder a `.sln` scan covers.
describe('parsePathsFromSln for .sln solutions', () => {
  it('resolves a trailing-separator project path to its parent folder', () => {
    const slnFile = getWorkspacePath('sln-website-project/mySolution.sln');

    expect(sln.parsePathsFromSln(slnFile)).toEqual([
      path.join('..', '..', 'WebSites'),
      'WebApplication2',
    ]);
  });
});

describe('parsePathsFromSln for .slnx solutions', () => {
  it('extracts project folders, including from solution folders', () => {
    const slnxFile = getWorkspacePath('sln-example-app/mySolution.slnx');

    expect(sln.parsePathsFromSln(slnxFile)).toEqual([
      'dotnet2_new_mvc_project',
      'WebApplication2',
    ]);
  });

  it('extracts the same folders as the equivalent .sln solution', () => {
    const workspace = 'sln-example-app/mySolution';

    expect(
      sln.parsePathsFromSln(getWorkspacePath(`${workspace}.slnx`)),
    ).toEqual(sln.parsePathsFromSln(getWorkspacePath(`${workspace}.sln`)));
  });

  it('ignores commented out projects', () => {
    const slnxFile = getWorkspacePath('slnxSolution.slnx');

    expect(sln.parsePathsFromSln(slnxFile)).not.toContain('removed-app');
  });

  it('throws when the solution file does not exist', () => {
    const slnxFile = getWorkspacePath('sln-example-app/noSuchSolution.slnx');

    expect(() => sln.parsePathsFromSln(slnxFile)).toThrow('File not found: ');
  });

  // Solution paths are XML attribute values, so anything an XML writer is
  // allowed to escape has to be unescaped before it is used as a path. A
  // numeric reference for a separator is the case that matters: left encoded,
  // the path collapses to the solution's own folder.
  it.each([
    ['a named entity', 'R&amp;D Lib/RD.Lib.csproj', 'R&D Lib'],
    ['a hex numeric reference', 'R&#x26;D Lib/RD.Lib.csproj', 'R&D Lib'],
    ['a decimal numeric reference', 'R&#38;D Lib/RD.Lib.csproj', 'R&D Lib'],
    ['an encoded separator', 'src&#47;App/App.csproj', path.join('src', 'App')],
    ['an escaped ampersand', 'R&amp;amp;D/RD.csproj', 'R&amp;D'],
  ])('decodes %s in a project path', (_, written, expected) => {
    const slnxFile = writeTempSolution(
      `<Solution><Project Path="${written}" /></Solution>`,
    );

    expect(sln.parsePathsFromSln(slnxFile)).toEqual([expected]);
  });

  it('reads a single-quoted Path attribute', () => {
    const slnxFile = writeTempSolution(
      `<Solution><Project Path='Service/Service.csproj' /></Solution>`,
    );

    expect(sln.parsePathsFromSln(slnxFile)).toEqual(['Service']);
  });

  it('finds no projects in an empty solution', () => {
    const slnxFile = writeTempSolution('<Solution />');

    expect(sln.parsePathsFromSln(slnxFile)).toEqual([]);
  });
});

describe('updateArgs for .slnx solutions', () => {
  it('replaces --file with the folders of the projects it holds', () => {
    const args = {
      options: {
        file: getWorkspacePath('sln-example-app/mySolution.slnx'),
        _: [],
      },
    };

    sln.updateArgs(args);

    expect(args.options.file).toBeUndefined();
    args.options._.pop();
    expect(basenames(args.options._)).toEqual([
      'dotnet2_new_mvc_project',
      'WebApplication2',
    ]);
  });

  it('resolves project paths relative to the solution file', () => {
    const args = {
      options: {
        file: getWorkspacePath('slnxSolution.slnx'),
        _: [],
      },
    };

    sln.updateArgs(args);

    expect(args.options.file).toBeUndefined();
    args.options._.pop();
    expect(basenames(args.options._)).toEqual(['nuget-app', 'nuget-app-2.1']);
  });

  it('throws when no project in the solution has a supported manifest', () => {
    const args = {
      options: {
        file: getWorkspacePath('sln-no-supported-files/mySolution.slnx'),
        _: [],
      },
    };

    expect(() => sln.updateArgs(args)).toThrow(
      'Could not detect supported target files in dotnet2_new_mvc_project, WebApplication2',
    );
  });

  it('throws when the solution holds no resolvable project', () => {
    const args = {
      options: { file: getWorkspacePath('emptySolution.slnx'), _: [] },
    };

    expect(() => sln.updateArgs(args)).toThrow(
      /Could not detect supported target files in/,
    );
  });

  it('throws when --file is empty', () => {
    expect(() => sln.updateArgs({ options: { _: [] } })).toThrow(
      /Empty --file argument/,
    );
  });
});

import { processCommandArgs } from '../src/cli/commands/process-command-args';
describe('display help message', () => {
  it('should return expected options & paths when path is undefined', () => {
    const cliArgs = [undefined, {}];
    const defaultCurrentPath = process.cwd();
    const { options, paths } = processCommandArgs(...cliArgs);

    expect(options).toEqual({});
    expect(paths).toEqual([defaultCurrentPath]);
  });

  it('should return expected options & paths when path is undefied + --json', () => {
    const cliArgs = [undefined, { json: true }];
    const defaultCurrentPath = process.cwd();
    const { options, paths } = processCommandArgs(...cliArgs);

    expect(options).toEqual({ json: true });
    expect(paths).toEqual([defaultCurrentPath]);
  });

  it('should return expected options & paths when path & options provided', () => {
    const cliArgs = [
      'test/acceptance/workspaces/ruby-app',
      { _: ['test/acceptance/workspaces/ruby-app'], json: true },
    ];

    const { options, paths } = processCommandArgs(...cliArgs);
    expect(paths).toEqual(['test/acceptance/workspaces/ruby-app']);
    expect(options).toEqual({
      _: ['test/acceptance/workspaces/ruby-app'],
      json: true,
    });
  });

  it('should return expected options & paths when multiple paths provided', () => {
    const cliArgs = [
      'test/acceptance/workspaces/ruby-app',
      'test/acceptance/workspaces/pip-app',
      {
        _: [
          'test/acceptancaces/ruby-app',
          'test/acceptance/workspaces/pip-app',
        ],
        allProjects: true,
      },
    ];

    const { options, paths } = processCommandArgs(...cliArgs);
    expect(paths.sort()).toEqual(
      [
        'test/acceptance/workspaces/ruby-app',
        'test/acceptance/workspaces/pip-app',
      ].sort(),
    );
    expect(options.allProjects).toBeTruthy();
  });

  it('should return expected options & paths when packageName is provided', () => {
    const cliArgs = ['semver@2'];

    const { options, paths } = processCommandArgs(...cliArgs);
    expect(paths.sort()).toEqual(['semver@2']);
    expect(options).toEqual({});
  });
});

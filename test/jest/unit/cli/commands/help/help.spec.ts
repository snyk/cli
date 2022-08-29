import * as help from '../../../../../../src/cli/commands/help';

describe('findHelpFile', () => {
  it('returns default help README path with no arguments', () => {
    expect(help.findHelpFile([], '../../../../help/cli-commands')).toContain(
      'README.md',
    );
  });

  it('returns default help README path with non-existing command', () => {
    expect(
      help.findHelpFile(['rainmaker'], '../../../../help/cli-commands'),
    ).toContain('README.md');
  });

  it('returns correct help markdown path with a `test` command', () => {
    expect(
      help.findHelpFile(['test'], '../../../../help/cli-commands'),
    ).toContain('test.md');
  });

  it('returns correct help markdown path with a `container` command', () => {
    expect(
      help.findHelpFile(['container'], '../../../../help/cli-commands'),
    ).toContain('container.md');
  });

  it('returns correct help markdown path with a `container test` subcommand', () => {
    expect(
      help.findHelpFile(['container', 'test'], '../../../../help/cli-commands'),
    ).toContain('container-test.md');
  });

  it('returns correct help markdown path with a `container monitor` subcommand', () => {
    expect(
      help.findHelpFile(
        ['container', 'monitor'],
        '../../../../help/cli-commands',
      ),
    ).toContain('container-monitor.md');
  });

  it('returns correct help markdown path for a documented subcommand with `iac describe`', () => {
    expect(
      help.findHelpFile(['iac', 'describe'], '../../../../help/cli-commands'),
    ).toContain('iac-describe.md');
  });

  it('returns correct help markdown path for a documented subcommand with `iac update-exclude-policy`', () => {
    expect(
      help.findHelpFile(
        ['iac', 'update-exclude-policy'],
        '../../../../help/cli-commands',
      ),
    ).toContain('iac-update-exclude-policy.md');
  });
});

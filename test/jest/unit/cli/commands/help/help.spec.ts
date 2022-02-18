import * as help from '../../../../../../src/cli/commands/help';

describe('getHelpFilePath', () => {
  test('should find iac.md', () => {
    expect(help.getHelpFilePath(['help', 'iac'])).toContain(
      '/help/cli-commands/iac.md',
    );
    expect(help.getHelpFilePath(['iac'])).toContain(
      '/help/cli-commands/iac.md',
    );
  });

  test('should find README.md', () => {
    expect(help.getHelpFilePath(['wrongcommand', '--help'])).toContain(
      'help/cli-commands/README.md',
    );
    expect(help.getHelpFilePath(['wrongcommand'])).toContain(
      'help/cli-commands/README.md',
    );
    expect(help.getHelpFilePath(['help', 'wrongcommand'])).toContain(
      'help/cli-commands/README.md',
    );
  });

  test('should find container.md', () => {
    expect(help.getHelpFilePath(['container', 'test'])).toContain(
      'help/cli-commands/container.md',
    );
    expect(help.getHelpFilePath(['container'])).toContain(
      'help/cli-commands/container.md',
    );
    expect(help.getHelpFilePath(['help', 'container'])).toContain(
      'help/cli-commands/container.md',
    );
  });

  test('should find iac-drift.md', () => {
    expect(help.getHelpFilePath(['iac', 'drift'])).toContain(
      'help/cli-commands/iac-drift.md',
    );
    expect(help.getHelpFilePath(['iac', 'drift', 'scan'])).toContain(
      'help/cli-commands/iac-drift.md',
    );
  });
});

describe('getSubcommandWithoutFlags', () => {
  test('should filter out CLI flags', () => {
    expect(
      help.getSubcommandWithoutFlags([
        '/usr/local/bin/node',
        '/home/test/index.js',
        'iac',
        'drift',
        '--help',
      ]),
    ).toEqual(['iac', 'drift']);
  });

  test('should return empty array', () => {
    expect(
      help.getSubcommandWithoutFlags([
        '/usr/local/bin/node',
        '/home/test/index.js',
      ]),
    ).toEqual([]);
  });

  test('should return filter out absolute paths', () => {
    expect(
      help.getSubcommandWithoutFlags([
        '/usr/local/bin/node',
        '/home/test/index.js',
        'iac',
        'test',
        '../plan.json',
      ]),
    ).toEqual(['iac', 'test']);
    expect(
      help.getSubcommandWithoutFlags([
        '/usr/local/bin/node',
        '/home/test/index.js',
        'iac',
        'test',
        'plan.json',
      ]),
    ).toEqual(['iac', 'test']);
    expect(
      help.getSubcommandWithoutFlags([
        '/usr/local/bin/node',
        '/home/test/index.js',
        'iac',
      ]),
    ).toEqual(['iac']);
  });
});

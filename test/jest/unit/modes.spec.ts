import {
  UnsupportedOptionCombinationError,
  CustomError,
} from '../../../src/lib/errors';
import {
  parseMode,
  modeValidation,
  displayModeHelp,
} from '../../../src/cli/modes';

describe('display help message', () => {
  it('should do nothing when it is missing command', () => {
    const expectedCommand = 'container';
    const expectedArgs = {
      _: [],
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    // verify command should be "container"
    expect(command).toBe(expectedCommand);

    // verify 'args should be the same'
    expect(cliArgs).toEqual(expectedArgs);

    // verify 'should not set docker option';
    expect(cliArgs['docker']).toBeFalsy();
  });

  it('should change the command to help with help="container"', () => {
    const expectedCommand = 'container';
    const expectedArgs = {
      _: [],
      help: 'container',
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = displayModeHelp(cliCommand, cliArgs);

    // verify 'command should be "container"'
    expect(command).toBe(expectedCommand);

    // verify 'args should contain "help" as key and "container" as value'
    expect(cliArgs).toEqual(expectedArgs);
  });

  it('command "container --help" should change the command to help with help="container"', () => {
    const expectedCommand = 'container';
    const expectedArgs = {
      _: [],
      help: 'container',
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: [],
      help: true,
      'package-manager': 'pip',
    };

    const command = displayModeHelp(cliCommand, cliArgs);

    // verify 'command should be "container"'
    expect(command).toBe(expectedCommand);
    // verify 'args should contain "help" as key and "container" as value'
    expect(cliArgs).toEqual(expectedArgs);
  });

  it('command "container test --help" should change the command to help with help="container"', () => {
    const expectedCommand = 'container';
    const expectedArgs = {
      _: ['test'],
      help: 'container',
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: ['test'],
      help: true,
      'package-manager': 'pip',
    };

    const command = displayModeHelp(cliCommand, cliArgs);
    // verify 'command should be "container"'
    expect(command).toBe(expectedCommand);
    // verify 'args should contain "help" as key and "container" as value'
    expect(cliArgs).toEqual(expectedArgs);
  });
});

describe('when is not a valid mode', () => {
  it('should do nothing', () => {
    const cliCommand = 'test';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    expect(command).toBe(cliCommand);
    expect(cliArgs).toEqual(cliArgs);
    expect(cliArgs['docker']).toBeFalsy();
  });
});

describe('when have a valid mode and command', () => {
  it('"container test" should set docker option and test command', () => {
    const expectedCommand = 'test';
    const expectedArgs = {
      _: [],
      docker: true,
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: ['test'],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    expect(command).toBe(expectedCommand);
    expect(cliArgs).toEqual(expectedArgs);
    expect(cliArgs['docker']).toBeTruthy();
  });

  it('"unmanaged test" should set unmanaged option and test command', () => {
    const expectedCommand = 'test';
    const expectedArgs = {
      _: [],
      unmanaged: true,
    };
    const cliCommand = 'unmanaged';
    const cliArgs = {
      _: ['test'],
    };

    const command = parseMode(cliCommand, cliArgs);
    expect(command).toBe(expectedCommand);
    expect(cliArgs).toEqual(expectedArgs);
    expect(cliArgs['unmanaged']).toBeTruthy();
  });

  it('"unmanaged monitor" should set unmanaged option and monitor command', () => {
    const expectedCommand = 'monitor';
    const expectedArgs = {
      _: [],
      unmanaged: true,
    };
    const cliCommand = 'unmanaged';
    const cliArgs = {
      _: ['monitor'],
    };

    const command = parseMode(cliCommand, cliArgs);
    expect(command).toBe(expectedCommand);
    expect(cliArgs).toEqual(expectedArgs);
    expect(cliArgs['unmanaged']).toBeTruthy();
  });
});

describe('when have a valid mode, command and exists a command alias', () => {
  it('"container test" should set docker option and test command', () => {
    const expectedCommand = 't';
    const expectedArgs = {
      _: [],
      docker: true,
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: ['t'],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    expect(command).toBe(expectedCommand);
    expect(cliArgs).toEqual(expectedArgs);
    expect(cliArgs['docker']).toBeTruthy();
  });
});

describe('when have a valid mode and not allowed command', () => {
  it('"container protect" should not set docker option and return same command', () => {
    const expectedCommand = 'container';
    const expectedArgs = {
      _: ['protect'],
      'package-manager': 'pip',
    };
    const cliCommand = 'container';
    const cliArgs = {
      _: ['protect'],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    expect(command).toBe(expectedCommand);
    expect(cliArgs).toEqual(expectedArgs);
    expect(cliArgs['docker']).toBeFalsy();
  });
});

describe('mode validation', () => {
  it('when there is no command, throw error', () => {
    const args = {
      command: 'container',
      options: {
        _: ['container'],
      },
    };

    try {
      modeValidation(args);
    } catch (err) {
      expect(err).toBeInstanceOf(CustomError);
      expect(err.message).toMatch('use snyk container with test or monitor');
    }
  });
  it('when command is not valid, throw error', () => {
    const args = {
      command: 'container',
      options: {
        _: ['protect', 'container'],
      },
    };

    try {
      modeValidation(args);
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedOptionCombinationError);
      expect(err.message).toBe(
        'The following option combination is not currently supported: container + protect',
      );
    }
  });

  it('when command is valid, do nothing', () => {
    const args = {
      command: 'container',
      options: {
        _: ['test', 'container'],
      },
    };

    expect(() => modeValidation(args)).not.toThrow();
  });

  it('when there is no valid mode, do nothing', () => {
    const args = {
      command: 'test',
      options: {
        _: ['test'],
      },
    };

    expect(() => modeValidation(args)).not.toThrow();
  });

  it('when there is no mode, do nothing', () => {
    const args = {
      command: '',
      options: {
        _: [],
      },
    };

    expect(() => modeValidation(args)).not.toThrow();
  });
});

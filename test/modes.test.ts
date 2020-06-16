import { test } from 'tap';
import {
  UnsupportedOptionCombinationError,
  CustomError,
} from '../src/lib/errors';
import { parseMode, modeValidation, displayModeHelp } from '../src/cli/modes';

test('display help message', (c) => {
  c.test('should do nothing when it is missing command', (t) => {
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

    t.equal(command, expectedCommand, 'command should be "container"');
    t.same(cliArgs, expectedArgs, 'args should be the same');
    t.notOk(cliArgs['docker'], 'should not set docker option');
    t.end();
  });

  c.test('should change the command to help with help="container"', (t) => {
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

    t.equal(command, expectedCommand, 'command should be "container"');
    t.same(
      cliArgs,
      expectedArgs,
      'args should contain "help" as key and "container" as value',
    );
    t.end();
  });

  c.test(
    'command "container --help" should change the command to help with help="container"',
    (t) => {
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

      t.equal(command, expectedCommand, 'command should be "container"');
      t.same(
        cliArgs,
        expectedArgs,
        'args should contain "help" as key and "container" as value',
      );
      t.end();
    },
  );

  c.test(
    'command "container test --help" should change the command to help with help="container"',
    (t) => {
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

      t.equal(command, expectedCommand, 'command should be "container"');
      t.same(
        cliArgs,
        expectedArgs,
        'args should contain "help" as key and "container" as value',
      );
      t.end();
    },
  );
  c.end();
});

test('when is not a valid mode', (c) => {
  c.test('should do nothing', (t) => {
    const cliCommand = 'test';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = parseMode(cliCommand, cliArgs);

    t.equal(command, cliCommand);
    t.equal(cliArgs, cliArgs);
    t.notOk(cliArgs['docker']);
    t.end();
  });
  c.end();
});

test('when is a valid mode', (c) => {
  c.test('when is allowed command', (d) => {
    d.test(
      '"container test" should set docker option and test command',
      (t) => {
        const expectedCommand = 'test';
        const expectedArgs = {
          _: [],
          docker: true,
          experimental: true,
          'package-manager': 'pip',
        };
        const cliCommand = 'container';
        const cliArgs = {
          _: ['test'],
          'package-manager': 'pip',
        };

        const command = parseMode(cliCommand, cliArgs);

        t.equal(command, expectedCommand);
        t.same(cliArgs, expectedArgs);
        t.ok(cliArgs['docker']);
        t.ok(cliArgs['experimental']);
        t.end();
      },
    );

    d.test('when there is a command alias', (t) => {
      t.test('"container t" should set docker option and test command', (t) => {
        const expectedCommand = 't';
        const expectedArgs = {
          _: [],
          docker: true,
          experimental: true,
          'package-manager': 'pip',
        };
        const cliCommand = 'container';
        const cliArgs = {
          _: ['t'],
          'package-manager': 'pip',
        };

        const command = parseMode(cliCommand, cliArgs);

        t.equal(command, expectedCommand);
        t.same(cliArgs, expectedArgs);
        t.ok(cliArgs['docker']);
        t.ok(cliArgs['experimental']);
        t.end();
      });
      t.end();
    });
    d.end();
  });

  c.test('when is not allowed command', (d) => {
    d.test(
      '"container protect" should not set docker option and return same command',
      (t) => {
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

        t.equal(command, expectedCommand);
        t.same(cliArgs, expectedArgs);
        t.notOk(cliArgs['docker']);
        t.notOk(cliArgs['experimental']);
        t.end();
      },
    );
    d.end();
  });

  c.test('mode validation', (d) => {
    d.test('when there is no command, throw error', (t) => {
      const args = {
        command: 'container',
        options: {
          _: ['container'],
        },
      };

      try {
        modeValidation(args);
      } catch (err) {
        t.ok(err instanceof CustomError, 'should throw CustomError');
        t.equal(
          err.message,
          'use snyk container with test or monitor',
          'should have error message',
        );
        t.end();
      }
    });

    d.test('when command is not valid, throw error', (t) => {
      const args = {
        command: 'container',
        options: {
          _: ['protect', 'container'],
        },
      };

      try {
        modeValidation(args);
      } catch (err) {
        t.ok(
          err instanceof UnsupportedOptionCombinationError,
          'should throw UnsupportedOptionCombinationError',
        );
        t.equal(
          err.message,
          'The following option combination is not currently supported: container + protect',
          'should have error message',
        );
        t.end();
      }
    });

    d.test('when command is valid, do nothing', (t) => {
      const args = {
        command: 'container',
        options: {
          _: ['test', 'container'],
        },
      };

      modeValidation(args);

      t.ok('should not throw error');
      t.end();
    });

    d.test('when there is no valid mode, do nothing', (t) => {
      const args = {
        command: 'test',
        options: {
          _: ['test'],
        },
      };

      modeValidation(args);

      t.ok('should not throw error');
      t.end();
    });

    d.test('when there is no mode, do nothing', (t) => {
      const args = {
        command: '',
        options: {
          _: [],
        },
      };

      modeValidation(args);

      t.ok('should not throw error');
      t.end();
    });
    d.end();
  });
  c.end();
});

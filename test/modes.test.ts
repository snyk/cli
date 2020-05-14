import { test } from 'tap';
import modes from '../src/cli/modes';

test('when is missing sub command', (t) => {
  t.test('should do nothing', (t) => {
    const cliCommand = 'container';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = modes(cliCommand, cliArgs);

    t.equal(command, cliCommand);
    t.equal(cliArgs, cliArgs);
    t.notOk(cliArgs['docker']);
    t.end();
  });
  t.end();
});

test('when is not a valid mode', (t) => {
  t.test('should do nothing', (t) => {
    const cliCommand = 'test';
    const cliArgs = {
      _: [],
      'package-manager': 'pip',
    };

    const command = modes(cliCommand, cliArgs);

    t.equal(command, cliCommand);
    t.equal(cliArgs, cliArgs);
    t.notOk(cliArgs['docker']);
    t.end();
  });
  t.end();
});

test('when is a valid mode', (t) => {
  t.test('when is allowed sub command', (t) => {
    t.test(
      '"container test" should set docker option and test command',
      (t) => {
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

        const command = modes(cliCommand, cliArgs);

        t.equal(command, expectedCommand);
        t.same(cliArgs, expectedArgs);
        t.ok(cliArgs['docker']);
        t.end();
      },
    );
    t.end();
  });

  t.test('when is not allowed sub command', (t) => {
    t.test(
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

        const command = modes(cliCommand, cliArgs);

        t.equal(command, expectedCommand);
        t.same(cliArgs, expectedArgs);
        t.notOk(cliArgs['docker']);
        t.end();
      },
    );
    t.end();
  });
  t.end();
});

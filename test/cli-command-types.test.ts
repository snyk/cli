import { test } from 'tap';
import { CommandResult, TestCommandResult } from '../src/cli/commands/types';

test('createHumanReadableTestCommandResult', (t) => {
  t.plan(3);
  const hrRes = TestCommandResult.createHumanReadableTestCommandResult(
    'hr result',
    '{ json result}',
  );
  t.equal(hrRes.toString(), 'hr result');
  t.equal(hrRes.getDisplayResults(), 'hr result');
  t.equal(hrRes.getJsonResult(), '{ json result}');
});

test('createJsonTestCommandResult', (t) => {
  t.plan(3);
  const result = TestCommandResult.createJsonTestCommandResult(
    '{ json result}',
  );
  t.equal(result.toString(), '{ json result}');
  t.equal(result.getDisplayResults(), '{ json result}');
  t.equal(result.getJsonResult(), '{ json result}');
});

test('CommandResult is a HumanReadableTestCommandResult', (t) => {
  t.plan(2);
  const result: CommandResult = TestCommandResult.createHumanReadableTestCommandResult(
    'hr result',
    '{ json result}',
  );
  t.equal(result.toString(), 'hr result');
  t.equal(result.getDisplayResults(), 'hr result');
});

test('CommandResult is a JsonTestCommandResult', (t) => {
  t.plan(2);
  const result: CommandResult = TestCommandResult.createJsonTestCommandResult(
    '{ json result}',
  );
  t.equal(result.toString(), '{ json result}');
  t.equal(result.getDisplayResults(), '{ json result}');
});

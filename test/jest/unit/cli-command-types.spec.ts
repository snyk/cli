import {
  CommandResult,
  TestCommandResult,
} from '../../../src/cli/commands/types';

test('createHumanReadableTestCommandResult', () => {
  const hrRes = TestCommandResult.createHumanReadableTestCommandResult(
    'hr result',
    '{ json result}',
  );
  expect(hrRes.toString()).toEqual('hr result');
  expect(hrRes.getDisplayResults()).toEqual('hr result');
  expect(hrRes.getJsonResult()).toEqual('{ json result}');
});

test('createJsonTestCommandResult', () => {
  const result = TestCommandResult.createJsonTestCommandResult(
    '{ json result}',
  );
  expect(result.toString()).toEqual('{ json result}');
  expect(result.getDisplayResults()).toEqual('{ json result}');
  expect(result.getJsonResult()).toEqual('{ json result}');
});

test('CommandResult is a HumanReadableTestCommandResult', () => {
  const result: CommandResult = TestCommandResult.createHumanReadableTestCommandResult(
    'hr result',
    '{ json result}',
  );
  expect(result.toString()).toEqual('hr result');
  expect(result.getDisplayResults()).toEqual('hr result');
});

test('CommandResult is a JsonTestCommandResult', () => {
  const result: CommandResult = TestCommandResult.createJsonTestCommandResult(
    '{ json result}',
  );
  expect(result.toString()).toEqual('{ json result}');
  expect(result.getDisplayResults()).toEqual('{ json result}');
});

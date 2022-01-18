import { CommandResult, TestCommandResult } from '../types';

export default async function advise(): Promise<CommandResult> {
  return TestCommandResult.createHumanReadableTestCommandResult(
    "react - 88 [maintenance:inactive]",
    "{ \"bla\": \"bla bla\" }",
  );
}

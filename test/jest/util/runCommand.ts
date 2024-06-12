import { SpawnOptionsWithoutStdio } from "child_process";
import { spawn } from "cross-spawn";

type RunCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  stdoutBuffer?: Buffer;
  stderrBuffer?: Buffer;
};

// bufferOutput sets the RunCommandResult stdoutBuffer and stderrBuffer
// useful if the stdout or stderr string output is too large for the v8 engine
type RunCommandOptions = SpawnOptionsWithoutStdio & {
  bufferOutput?: boolean;
  logErrors?: boolean;
};

const runCommand = (
  command: string,
  args: string[],
  options?: RunCommandOptions
): Promise<RunCommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.on("error", error => {
      reject(error);
    });

    child.stdout.on("data", chunk => {
      stdout.push(Buffer.from(chunk));
    });

    child.stderr.on("data", chunk => {
      stderr.push(Buffer.from(chunk));
    });

    child.on("close", code => {
      const result: RunCommandResult = {
        code: code || 0,
        stdout: "",
        stderr: ""
      };

      if (options?.bufferOutput) {
        result.stdoutBuffer = Buffer.concat(stdout);
        result.stderrBuffer = Buffer.concat(stderr);
      } else {
        result.stdout = Buffer.concat(stdout).toString("utf-8");
        result.stderr = Buffer.concat(stderr).toString("utf-8");
      }

      if (options?.logErrors && result.code !== 0) {
        console.log("stderr:", result.stderr);
      }

      resolve(result);
    });
  });
};

export { runCommand, RunCommandResult, RunCommandOptions };

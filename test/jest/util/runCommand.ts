import { SpawnOptionsWithoutStdio } from 'child_process';
import { spawn } from 'cross-spawn';

type RunCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type RunCommandOptions = SpawnOptionsWithoutStdio;

const runCommand = (
  command: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.on('error', (error) => {
      reject(error);
    });

    child.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    child.on('close', (code) => {
      resolve({
        code: code || 0,
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
      });
    });
  });
};

function runCommandsWithUserInputs(
  command: string,
  args: string[] = [],
  inputs: string[] = [],
  options?: RunCommandOptions,
): Promise<any> {
  const timeout = 100;
  const childProcess = spawn(command, args, options);

  // Creates a loop to feed user inputs to the child process
  // in order to get results from the tool
  // This code is heavily inspired (if not blantantly copied)
  // from inquirer-test package
  const loop = (inputs) => {
    if (!inputs.length) {
      childProcess.stdin.end();
      return;
    }

    setTimeout(() => {
      childProcess.stdin.write(inputs[0]);
      loop(inputs.slice(1));
    }, timeout);
  };

  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    childProcess.on('error', (error) => {
      reject(error);
    });

    childProcess.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
    });

    childProcess.stderr.on('data', (chunk) => {
      stderr.push(Buffer.from(chunk));
    });

    childProcess.on('close', (code) => {
      resolve({
        code: code || 0,
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
      });
    });

    loop(inputs);
  });
}

export {
  runCommand,
  runCommandsWithUserInputs,
  RunCommandResult,
  RunCommandOptions,
};

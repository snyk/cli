interface ModeData {
  allowedSubCommands: Array<string>;
  config: (args) => void;
}

const modes: Record<string, ModeData> = {
  container: {
    allowedSubCommands: ['test', 'monitor'],
    config: (args): void => {
      args['docker'] = true;
    },
  },
};

const isModesAllowed = (command) => Object.keys(modes).includes(command);

const isSubCommandAllowed = (command, subCommand) =>
  modes[command].allowedSubCommands.includes(subCommand);

const configArgs = (command, args) => modes[command].config(args);

export default (command, args): string => {
  if (isModesAllowed(command)) {
    const subCommand = args._[0] as string; // can actually be undefined

    if (isSubCommandAllowed(command, subCommand)) {
      configArgs(command, args);
      command = args._.shift() as string; // can actually be undefined
    }
  }

  return command;
};

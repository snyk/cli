module.exports = function () {
  return {
    return: !!process.env.TAP,
    booleans: ['version', 'help'],
    options: [],
    alias: {},
    commands: {
      version: ':::./version',
      help: ':::./help',
    },
  };
};
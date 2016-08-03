module.exports = {
  commands: {
    _: 'cli/resolve',
  },
  options: ['filter', 'count'],
  alias: { d: 'dev', g: 'filter' },
  booleans: [
    'disk',
    'json',
    'errors',
    'dev',
    'production',
    'unique',
    'optional',
  ].concat(require('./filter').flags),
  help: 'usage.txt',
};

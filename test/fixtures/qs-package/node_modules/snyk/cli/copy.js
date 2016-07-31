module.exports = copy;

var cp = require('child_process');
var program = {
  darwin: 'pbcopy',
  win32: 'clip',
  linux: 'xclip -selection clipboard',
}[process.platform];

function copy(str) {
  return cp.execSync(program, { input: str });
}

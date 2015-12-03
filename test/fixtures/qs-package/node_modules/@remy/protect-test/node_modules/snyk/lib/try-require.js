module.exports = tryRequire;

var fs = require('fs');

function tryRequire(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    return null;
  }
}
var fs = require('then-fs');
var path = require('path');

module.exports = function tryGetSpec(dir, name) {
  var file = path.resolve(dir, name);
  if (fs.existsSync(file)) {
    return {
      name: name,
      contents: new Buffer(fs.readFileSync(file)).toString('base64'),
    };
  }
  return null;
};

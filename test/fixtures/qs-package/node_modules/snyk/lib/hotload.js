module.exports = hotload;

var path = require('path');

// this will speed up the module load time, only loading the CLI commands
// as needed by the user, and totally avoiding if the module is being required
// into a user project
function hotload(dir) {
  return function (name) {
    var module = null;
    return function () {
      if (module === null) {
        module = require(path.relative(__dirname, path.resolve(dir, name)));
      }

      return module.apply(null, arguments);
    };
  };
}

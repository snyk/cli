module.exports = help;

var fs = require('then-fs');
var path = require('path');

function help(item) {
  if (!item || item === true || typeof item !== 'string') {
    item = 'usage';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was eaiser to read
  item = item.replace(/[^a-z-]/gi, '');

  var filename = path.resolve(__dirname, '..', '..', 'help', item + '.txt');
  return fs.readFile(filename, 'utf8')
    .catch(function () {
      return '"' + item + '" help can\'t be found';
    });
}

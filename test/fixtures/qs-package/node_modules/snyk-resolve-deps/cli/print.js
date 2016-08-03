module.exports = print;

var tree = require('snyk-tree');
var colour = require('ansicolors');
var path = require('path');
var ext = colour.bgBlack(colour.green('extraneous'));
var bundled = colour.bgBlack(colour.yellow('bundled'));

function print(args, res) {
  res.version += ' ' + path.dirname(res.__filename);
  var printed = '';
  printed = tree(res, function (leaf) {
    var label = leaf.full;

    if (leaf.extraneous) {
      label += ' ' + ext;
    }

    if (leaf.bundled) {
      label += ' ' + bundled;
    }

    if (leaf.shrinkwrap) {
      label += ' ' + colour.bgBlack(colour.yellow('shrinkwrap via ' +
        leaf.shrinkwrap));
    }

    return label;
  });

  if (args.errors && res.problems && res.problems.length) {
    printed += res.problems.join('\n');
  }

  return printed;
}

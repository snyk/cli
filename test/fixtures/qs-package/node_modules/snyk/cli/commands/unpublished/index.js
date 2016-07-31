var Promise = require('es6-promise').Promise; // jshint ignore:line
var resolve = require('snyk-resolve-deps');
var tree = require('snyk-tree');
var prune = require('./prune');
var walk = require('./walk');
var spinner = require('../../../lib/spinner');
var fs = require('fs');
var chalk = require('chalk');

module.exports = function (cwd) {
  if (!cwd) {
    cwd = process.cwd();
  }

  var packages = fs.readFileSync(__dirname + '/package-list.txt', 'utf8')
    .split('\n').map(function (s) {
    return s.trim();
  });

  var tail = fs.readFileSync(__dirname + '/tail.txt', 'utf8');
  var lbl = fs.readFileSync(__dirname + '/head.txt', 'utf8');

  spinner.sticky();

  return spinner(lbl).then(function () {
    return resolve(cwd, { dev: true, disk: true }).then(function (res) {
      prune(res, function (p) {
        // console.log(p.name, packages.indexOf(p.name) === -1);
        return packages.indexOf(p.name) === -1;
      });

      if (Object.keys(res.dependencies).length === 0) {
        return 'This dependency tree does not include any packages from the ' +
          '@azer user.';
      }

      // now check the specific version
      return walk(res, function (p) {
        if (packages.indexOf(p.name) !== -1) {
          p.warning = '! package has been unpublished';
        }
      }).then(function () {
        return tree(res, function (leaf) {
          var label = leaf.full;

          if (leaf.warning) {
            label += ' ' + chalk.bgRed.white(leaf.warning);
          }

          return label;
        }) + tail + chalk.bold('👉  https://snyk.io/blog/testing-for-unpubli' +
        'shed-packages/\n');
      });
    });
  }).then(spinner.clear(lbl));
};

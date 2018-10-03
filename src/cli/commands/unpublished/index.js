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

  var config = JSON.parse(
    fs.readFileSync(__dirname + '/../../../../test-unpublished.json', 'utf8')
  );

  var packages = config.packages;
  var tail = config.tail;
  var lbl = config.head;

  spinner.sticky();

  return spinner(lbl).then(function () {
    return resolve(cwd, {dev: true, disk: true}).then(function (res) {
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
  })
    // clear spinner in case of success or failure
    .then(spinner.clear(lbl))
    .catch(function (error) {
      spinner.clear(lbl)();
      throw error;
    });
};

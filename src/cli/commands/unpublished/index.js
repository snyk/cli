const resolve = require('snyk-resolve-deps');
const tree = require('snyk-tree');
const prune = require('./prune');
const walk = require('./walk');
const spinner = require('../../../lib/spinner');
const fs = require('fs');
const chalk = require('chalk');

module.exports = function (cwd) {
  if (!cwd) {
    cwd = process.cwd();
  }

  const config = JSON.parse(
    fs.readFileSync(__dirname + '/../../../../test-unpublished.json', 'utf8')
  );
  const {packages, tail, head} = config;

  spinner.sticky();

  return spinner(head).then(function () {
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
          let label = leaf.full;

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
    .then(spinner.clear(head))
    .catch(function (error) {
      spinner.clear(head)();
      throw error;
    });
};

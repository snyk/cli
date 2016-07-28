module.exports = logicalTree;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var pluck = require('./pluck');
var walk = require('./walk');
var unique = require('./unique');
var path = require('path');
var depTypes = require('./dep-types');
var colour = require('ansicolors');
var moduleToObject = require('snyk-module');
var _ = require('lodash');
var format = require('util').format;
var ext = colour.bgBlack(colour.green('extraneous'));
var problems = [];

/**
 * This code will build up the logical tree representation of a node package
 * and it's dependencies. This is based initially on reading the directory
 * structure and the package.json files found in each directory.
 *
 * After which, we parse the tree and read the `__dependencies` looking for
 * their actual location on disk (or if it's missing, etc) - marking as we
 * go along that the leaf has been used.
 *
 * After that, we need to search for the original tree for unused leafs, and
 * these will be marked as extraneous and carried through to the logical
 * tree at the same depth.
 *
 * Important: some extraneous modules will actually be from devDependencies
 * from the root level, so we need to handle these carefully.
 */


function logicalTree(fileTree, options) {
  if (!options) {
    options = {};
  }

  problems = [];
  var logicalRoot = copy(fileTree, fileTree.__from, true);
  logicalRoot.dependencies = walkDeps(fileTree, fileTree);

  var removedPaths = [];

  if (!options.dev) {
    // do a shallow pass on the deps and strip out dev deps
    Object.keys(fileTree.dependencies).forEach(function (name) {
      var dep = fileTree.dependencies[name];
      // if we're not interested in devDeps, then strip them out
      if (dep.depType === depTypes.DEV) {
        // since dev deps are only ever on the root, we know we can remove it
        // directly from the logicalRoot.dependencies
        removedPaths.push(dep.__from);
        delete logicalRoot.dependencies[dep.name];
        return;
      }
    });
  }

  logicalRoot.numFileDependencies = 0;

  walk(fileTree.dependencies, function (dep) {
    logicalRoot.numFileDependencies++;
    if (!dep.__used) {
      var deppath = dep.__from.slice(0, -1).toString();
      var removed = removedPaths.filter(function (path) {
        return deppath.indexOf(path) === 0;
      }).length;

      if (removed) {
        return false; // this was from a dev dep, so let's lose it
      }

      var leaf = copy(dep);

      var issue = format('%s: %s@%s (from %s) > %s', ext, leaf.name,
        leaf.version, leaf.dep, path.relative('.', leaf.__filename));
      leaf.problems = [issue];
      problems.push(issue);
      leaf.extraneous = true;
      leaf.depType = depTypes.EXTRANEOUS;
      leaf.dependencies = walkDeps(fileTree, dep);
      walk(leaf.dependencies, function (dep) {
        dep.extraneous = true;
        dep.depType = depTypes.EXTRANEOUS;
      });
      insertLeaf(logicalRoot, leaf, dep.__from);
    }
  });

  logicalRoot.numDependencies = Object.keys(
    unique(logicalRoot).dependencies
  ).length;

  logicalRoot.pluck = pluck.bind(null, fileTree);
  logicalRoot.unique = unique.bind(null, logicalRoot);
  logicalRoot.problems = problems.slice(0);

  return logicalRoot;
}

function insertLeaf(tree, leaf, from) {
  // remove the root of the path and covert to names only
  var path = (from || []).slice(1, -1).map(function (pkg) {
    return moduleToObject(pkg).name;
  });
  var entry = tree.dependencies;
  for (var i = 0; i < path.length; i++) {
    if (entry[path[i]]) {
      entry = entry[path[i]].dependencies;
    }
  }
  entry[leaf.name] = leaf;
}

function walkDeps(root, tree, from) {
  if (!from) {
    from = tree.__from;
  }

  // only include the devDeps on the root level package
  var deps = _.extend({}, tree.__dependencies,
    tree.__from && from.length === 1 ? tree.__devDependencies : {});

  deps = _.extend(deps, tree.__optionalDependencies);

  return Object.keys(deps).reduce(function walkDepsPicker(acc, curr) {
    // only attempt to walk this dep if it's not in our path already
    if (tree.__from.indexOf(curr) === -1) {
      var version = deps[curr];
      var dep = pluck(root, tree.__from, curr, version);

      if (!dep) {
        problems.push(format('missing: %s@%s, required by %s', curr, version,
          from.join(' > ')));
        return acc;
      }

      if (from.indexOf(dep.full) === -1) {
        var pkg = acc[dep.name] = copy(dep, from.concat(dep.full));
        dep.__used = true;
        var info = depTypes(dep.name, {
          dependencies: tree.__dependencies,
          devDependencies: tree.__devDependencies,
          optionalDependencies: tree.__optionalDependencies,
          bundleDependencies: tree.__bundleDependencies,
        });

        pkg.depType = info.type;
        pkg.dep = info.from;
        if (tree.bundled) { // carry the bundled flag down from the parent
          dep.bundled = pkg.bundled = tree.bundled;
        }

        pkg.dependencies = walkDeps(root, dep, pkg.from);
      }
    }

    return acc;
  }, {});
}

function copy(leaf, from) {
  if (!from) {
    from = leaf.__from;
  }

  var res = Object.keys(leaf).reduce(function copyIterator(acc, curr) {
    if (leaf[curr] !== undefined && curr.indexOf('__') !== 0) {
      if (curr !== 'dependencies') {
        acc[curr] = leaf[curr];
      }
    }
    return acc;
  }, {});

  res.from = from.slice(0);
  res.__filename = leaf.__filename;

  return res;
}

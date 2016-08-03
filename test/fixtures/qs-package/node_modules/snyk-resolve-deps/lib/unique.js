module.exports = unique;

var walk = require('./walk');

function unique(deps) {
  var res = copy(deps);
  res.dependencies = {};

  walk(deps, function (dep) {
    var shallowCopy = copy(dep);
    res.dependencies[dep.name + '@' + dep.version] = shallowCopy;
  });

  return res;
}

function copy(dep) {
  return Object.keys(dep).filter(function (key) {
    return key.toLowerCase().indexOf('dependencies') === -1;
  }).reduce(function (acc, curr) {
    acc[curr] = dep[curr];
    return acc;
  }, {});
}

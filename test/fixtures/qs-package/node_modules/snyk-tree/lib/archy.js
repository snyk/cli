module.exports = makeArchy;

var archy = require('archy');

function defaultRender(leaf) {
  var label = leaf.name;
  if (leaf.version) {
    label += '@' + leaf.version;
  }

  return label;
}

function makeArchy(data, render) {
  if (!render) {
    render = defaultRender;
  }

  return archy(walkDepTree(data, null, function (leaf) {
    var label = render(leaf.data);

    if (leaf.deps) {
      return {
        label: label,
        nodes: leaf.deps,
      };
    } else {
      return label;
    }
  }));
}

function walkDepTree(data, parent, fn) {
  var deps = null;

  if (!data.parent) {
    data.parent = [];
  }

  if (parent) {
    data.parent.push({
      name: parent.name,
      version: parent.version,
    });
  }

  if (data.dependencies) {
    deps = Object.keys(data.dependencies).sort().map(function (module) {
      var dep = data.dependencies[module];
      if (!dep.name) {
        dep.name = module;
      }
      return walkDepTree(dep, data, fn);
    });
  }

  return fn({
    data: data,
    deps: deps,
  });
}

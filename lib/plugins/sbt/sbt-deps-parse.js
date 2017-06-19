var tabdown = require('./tabdown');

function converStrToTree(dependenciesTextTree) {
  var lines = dependenciesTextTree.toString().split('\n');
  var newLines = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('+-') > -1 ||
        i + 1 !== lines.length &&
        lines[i + 1].indexOf('+-') > -1 &&
        lines[i].length > 10) {
      var line = lines[i];
      if (line.indexOf('|') > -1) {
        line = line.slice(line.indexOf('|'), line.length);
      } else if (line.indexOf('+-') > -1) {
        line = line.slice(line.indexOf('+-'), line.length);
      }
      line = line.split('|').join(' \t');
      line = line.split('+-').join(' \t');
      line = line.split('\u001b[0m').join('');
      line = line.split('[info]').join('');
      line = line.split(' [S]').join('');
      line = line.split('[]').join('');
      line = line.split('   ').join(' \t');
      newLines.push(line);
    }
  }
  var tree = tabdown.parse(newLines, '\t');
  return tree;
}

function walkInTree(toNode, fromNode, parentNode) {
  if (!toNode.from) {
    toNode.from = [];
  }

  toNode.from.splice(0, 0, toNode.name + '@' + toNode.version);
  if (parentNode) {
    toNode.from = parentNode.from.concat(toNode.from);
  }

  if (fromNode.children && fromNode.children.length > 0) {
    for (var j = 0; j < fromNode.children.length; j++) {
      if (fromNode.children[j].data.indexOf('php') === -1) {
        var externalNode = getPackageNameAndVersion(
          fromNode.children[j].data);
        if (externalNode) {
          var coords = externalNode.name.split(':');
          var newNode = {
            groupId: coords[0],
            artifactId: coords[1],
            version: externalNode.version,
            name: externalNode.name,
            dependencies: [],
            from: [],
          };
          toNode.dependencies.push(newNode);
          walkInTree(toNode.dependencies[toNode.dependencies.length - 1],
            fromNode.children[j],
            toNode);
        }
      }
    }
  }
  delete toNode.parent;
}

function getPackageNameAndVersion(packageDependency) {
  var splited, version, app;
  if (packageDependency.indexOf('(evicted by:') > -1) {
    return null;
  }
  splited = packageDependency.split(':');
  version = splited[splited.length - 1];
  app = splited[0] + ':' + splited[1];
  app = app.split('\t').join('');
  app = app.trim();
  version = version.trim();
  return { name: app, version: version };
}

function convertDepArrayToObject(depsArr) {
  if (!depsArr) {
    return null;
  }
  return depsArr.reduce(function (acc, dep) {
    dep.dependencies = convertDepArrayToObject(dep.dependencies);
    acc[dep.name] = dep;
    return acc;
  }, {});
}

function parse(text, name, version) {
  var tree = converStrToTree(text);
  var snykTree = {
    name: name,
    version: version,
    dependencies: [],
  };
  walkInTree(snykTree, tree);
  snykTree.dependencies = convertDepArrayToObject(snykTree.dependencies);
  return snykTree;
}

module.exports = parse;

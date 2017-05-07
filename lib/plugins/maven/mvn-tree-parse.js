module.exports = parseTree;

var packageFormatVersion = 'mvn:0.0.1';
var newline = /[\r\n]+/g;
var logLabel = /^\[\w+\]\s*/gm;
var digraph = /digraph([\s\S]*?)\}/g;

// Parse the output from 'mvn dependency:tree -DoutputType=dot'
// Requires Maven >= 2.2
function parseTree(text) {
  text = text.replace(logLabel, '');
  return getRootProject(text);
}

function getRootProject(text) {
  var projects = text.match(digraph);
  var root = getProject(projects[0]);
  // Add any subsequent projects to the root as dependencies
  for (var i = 1; i < projects.length; i++) {
    var project = getProject(projects[i], root);
    root.dependencies[project.name] = project;
  }
  root.packageFormatVersion = packageFormatVersion;
  return root;
}

function getProject(projectDump, parent) {
  var lines = projectDump.split(newline);
  var identity = dequote(lines[0]);
  var deps = {};
  for (var i = 1; i < lines.length - 1; i++) {
    var line = lines[i];
    var nodes = line.trim().split('->');
    var source = dequote(nodes[0]);
    var target = dequote(nodes[1]);
    deps[source] = deps[source] || [];
    deps[source].push(target);
  }
  return assemblePackage(identity, deps, parent);
}

function assemblePackage(source, projectDeps, parent) {
  var sourcePackage = createPackage(source, parent);
  var sourceDeps = projectDeps[source];
  if (sourceDeps) {
    for (var i = 0; i < sourceDeps.length; i++) {
      var pkg = assemblePackage(sourceDeps[i], projectDeps, sourcePackage);
      sourcePackage.dependencies[pkg.name] = pkg;
    }
  }
  return sourcePackage;
}

function createPackage(pkgStr, parent) {
  var range = getConstraint(pkgStr);
  if (range) {
    pkgStr = pkgStr.substring(0, pkgStr.indexOf(' '));
  }
  var parts = pkgStr.split(':');
  var result = {
    groupId: parts[0],
    artifactId: parts[1],
    packaging: parts[2],
    version: parts[3],
    name: parts[0] + ':' + parts[1],
    dependencies: {},
  };
  var selfPkg = parts[0] + ':' + parts[1] + '@' + parts[3];
  result.from = parent ?
    parent.from.concat(selfPkg) :
    [selfPkg];
  if (parts.length === 5) {
    result.scope = parts[4];
  }
  if (range) {
    result.dep = range;
  }
  return result;
}

function dequote(str) {
  return str.slice(str.indexOf('"') + 1, str.lastIndexOf('"'));
}

function getConstraint(str) {
  var index = str.indexOf('selected from constraint');
  if (index === -1) {
    return null;
  }
  return str.slice(index + 25, str.lastIndexOf(')'));
}

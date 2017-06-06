var _ = require('../../../dist/lodash-min');

function processGradleOutput(text) {
  var omittedDeps = {};
  var lines = text.split('\n')
  .filter(function (element) {
    // filter out stuff that isn't dependencies
    return element.indexOf('\\---') !== -1 ||
      element.indexOf('+---') !== -1 ||
      element === '';
  })
  .reduce(function (acc, element) {
    // only return the first configuration, in case there are multiple
    if (acc.done) {
      return acc;
    }
    if (element === '') {
      if (acc.length > 0) {
        acc.done = true;
      }
      return acc;
    }
    acc.push(element);
    return acc;
  }, [])
  .filter(function (element) {
    // filter out FAILED dependencies
    return element.match(/ FAILED$/) === null;
  })
  .map(function (element) {
    // remove all hierarchy markings, but keep the hierarchy structure
    element = element
    .replace(/\|/g, ' ')          // remove pipe symbol
    .replace(/\\/g, '+')          // convert all prefixes to '+---'
    .replace(/\+\-\-\-/g, '    ') // remove all prefixes
    .replace(/     /g, ' ');      // convert each 5 spaces to 1 space
    // update the element with its resolved version, if exists
    var elementParts = element.split(' -> ');
    if (elementParts.length > 1) {
      element = element.replace(/[^:]*$/, elementParts[1]);
    }
    // mark omitted dependencies for later review,
    // and remove the '(*)' at the end of the element
    var omitStarSplit = element.split(' (*)');
    if (omitStarSplit.length > 1) {
      element = omitStarSplit[0];
      var parts = element.split(':');
      // omittedDeps key is 'groupId:artifactId' (without the version)
      omittedDeps[parts[0].trim() + ':' + parts[1]] = true;
    }

    return element;
  });
  return {
    lines: lines,
    omittedDeps: omittedDeps,
  };
}

function getIndent(line) {
  if (line) {
    return line.match(/^\s*/)[0].length;
  }
  return 0;
}

function getElementAsObject(element, parentElement) {
  if (!element) {
    return null;
  }
  var elementParts = element.trim().split(':');
  var groupId = elementParts[0];
  var artifactId = elementParts[1];
  var version = elementParts[2];
  return {
    groupId: groupId,
    artifactId: artifactId,
    version: version,
    name: groupId + ':' + artifactId,
    // array is required to keep the order for omitted deps,
    // will be converted to object after processing
    dependencies: [],
    from: parentElement ?
      parentElement.from.concat(groupId + ':' + artifactId + '@' + version) :
      [groupId + ':' + artifactId + '@' + version],
  };
}

function getSubTreeLines(lines, parentIndent) {
  var subTreeLines = [];
  for (var i = 0; i < lines.length; i++) {
    if (getIndent(lines[i]) <= parentIndent) {
      return subTreeLines;
    }
    subTreeLines.push(lines[i]);
  }
  return subTreeLines;
}

function updateFromArray(nodes, from) {
  nodes.map(function (node) {
    node.from = from.concat(node.from);
    updateFromArray(node.dependencies, from);
  });
}

function cloneOmittedDependencies(node, omittedDeps) {
  var clonedDeps = _.cloneDeep(omittedDeps[node.name]);
  updateFromArray(clonedDeps, node.from);
  return clonedDeps;
}

// splice out the first <removeFromTop> items from the 'from' array
// recursively into each node's dependencies
function cleanFromArray(nodes, removeFromTop, omittedDeps) {
  nodes.map(function (node) {
    node.from = node.from.splice(removeFromTop);
    if (typeof omittedDeps[node.name] === 'object') {
      // the current dependency is already in omittedDeps
      node.dependencies = cloneOmittedDependencies(node, omittedDeps);
    } else {
      cleanFromArray(node.dependencies, removeFromTop, omittedDeps);
    }
  });
}

// deep-clone a node's dependencies
function cloneDependencies(node, omittedDeps) {
  var clonedDeps = _.cloneDeep(node.dependencies);
  cleanFromArray(clonedDeps, node.from.length, omittedDeps);
  return clonedDeps;
}

function createTree(lines, omittedDeps, parentElement) {
  if (lines.length === 0) {
    return [];
  }
  var array = [];
  var currentLine = lines.shift();
  var currentIndent = getIndent(currentLine);
  var current = getElementAsObject(currentLine, parentElement);
  array.push(current);

  var nextLine = lines[0];
  var nextIndent;
  var next;
  while (nextLine) {
    nextIndent = getIndent(nextLine);
    if (nextIndent === currentIndent) {
      next = getElementAsObject(lines[0], parentElement);
      array.push(next);
      lines.shift();
    } else if (nextIndent > currentIndent) {
      next = getElementAsObject(lines[0], current);
      var subTreeLines = getSubTreeLines(lines, currentIndent);
      lines.splice(0, subTreeLines.length);
      current.dependencies = createTree(subTreeLines, omittedDeps, current);
    }
    if (omittedDeps[current.name] === true) {
      // we have an omitted dependency somewhere
      // create a clean copy of the current dependency and store it for later
      omittedDeps[current.name] = cloneDependencies(current, omittedDeps);
    }
    current = next;
    currentIndent = nextIndent;
    nextLine = lines[0];
  }
  return array;
}

function fillOmittedDependencies(nodes, omittedDeps) {
  if (nodes === null) {
    return;
  }
  nodes.map(function (node) {
    if (typeof omittedDeps[node.name] === 'object' &&
        _.keys(node.dependencies).length === 0) {
      node.dependencies = cloneOmittedDependencies(node, omittedDeps);
      return;
    }
    fillOmittedDependencies(node.dependencies, omittedDeps);
  });
}

// convert all dependencies from arrays to objects
function convertNodeArrayToObject(nodeArray) {
  return nodeArray.reduce(function (acc, element) {
    element.dependencies = convertNodeArrayToObject(element.dependencies);
    acc[element.name] = element;
    return acc;
  }, {});
}

function parse(outputText, from) {
  var processedData = processGradleOutput(outputText);
  var depArray = createTree(processedData.lines,
                           processedData.omittedDeps,
                           {from: [from]});
  fillOmittedDependencies(depArray, processedData.omittedDeps);
  var depTree = convertNodeArrayToObject(depArray);
  return depTree;
}

module.exports = parse;

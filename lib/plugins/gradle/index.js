var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('fs');
var path = require('path');
var subProcess = require('../../sub-process');

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, gradleArgs) {
  return subProcess.execute('gradle',
    buildArgs(root, targetFile, gradleArgs),
    { cwd: root })
  .then(function (result) {
    var packageName = path.basename(root);
    var packageVersion = '0.0.0';
    var lines = getDependencyLines(result);

    var from = [packageName + '@' + packageVersion];
    var depTree = createTree(lines, {
      from: from,
    });

    return {
      plugin: {
        name: 'bundled:gradle',
        runtime: 'unknown',
      },
      package: {
        dependencies: depTree,
        name: packageName,
        version: packageVersion,
        packageFormatVersion: 'mvn:0.0.1',
        from: from,
      },
    };
  });
}

function buildArgs(root, targetFile, gradleArgs) {
  var args = ['dependencies', '-q'];
  if (gradleArgs) {
    // if <gradleArgs> doesn't contain a '--configuration <config>' flag,
    // then add '--configuration runtime' to the args
    var gradleConfiguration = gradleArgs.filter(function (element) {
      return element.startsWith('--configuration ');
    });
    if (gradleConfiguration.length === 0) {
      args.push('--configuration runtime');
    }
  } else {
    args.push('--configuration runtime');
  }
  if (targetFile) {
    if (!fs.existsSync(path.resolve(root, targetFile))) {
      throw new Error('File not found: ' + targetFile);
    }
    args.push('--build-file ' + targetFile);
  }
  if (gradleArgs) {
    args.push(gradleArgs);
  }
  return args;
}

function getDependencyLines(text) {
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
    return !element.endsWith('FAILED');
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
    // remove the '(*)' at the end of the element, if exists
    element = element.split(' (*)').filter(Boolean).join();

    return element;
  });
  return lines;
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
    dependencies: {},
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

function createTree(lines, parentElement) {
  var node = {};
  if (lines.length === 0) {
    return node;
  }
  var linesToProcess = lines;
  var currentLine = linesToProcess.shift();
  var currentIndent = getIndent(currentLine);
  var current = getElementAsObject(currentLine, parentElement);
  node[current.name] = current;

  var nextLine = linesToProcess[0];
  var nextIndent;
  var next;
  while (nextLine) {
    nextIndent = getIndent(nextLine);
    if (nextIndent === currentIndent) {
      next = getElementAsObject(linesToProcess[0], parentElement);
      node[next.name] = next;
      linesToProcess.shift();
    } else if (nextIndent > currentIndent) {
      next = getElementAsObject(linesToProcess[0], current);
      var subTreeLines = getSubTreeLines(linesToProcess, currentIndent);
      linesToProcess.splice(0, subTreeLines.length);
      current.dependencies = createTree(subTreeLines, current);
    }
    current = next;
    nextLine = linesToProcess[0];
  }
  return node;
}

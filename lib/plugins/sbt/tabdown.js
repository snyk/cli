exports.parse = function (lines, marker) {

  var populatefn = populatefn || function (obj) { return obj; };
  marker = marker || '\t';

  function addHiddenProperties(scope, props) {
    for (var p in props) {
      Object.defineProperty(scope, p, {enumerable: false, value: props[p]});
    }
  }
  var TreeNode = function (data, depth) {
    this.parent = null;
    addHiddenProperties(this, {
      data: data,
      depth: depth,
      parent: null,
      children: [],
    });
    this[data || 'root'] = this.children;
  };

  TreeNode.prototype.toString = function () {
    return JSON.stringify(this.children);
  };

  var tree = new TreeNode(null, -1);

  var levels = [tree];

  function countTabs(line) {
    var count = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if ((ch === '\t')) {
        count += 1;
      } else if (/[^\s]/.test(ch)) {
        return count;
      }
    }
    return -1; // no content
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    var tabcount = countTabs(line);

    if (tabcount >= 0) {
      // then add node to tree
      while (tabcount - levels[levels.length - 1].depth <= 0) {
        levels.pop();
      }
      var depth = levels.length - 1;
      var node = new TreeNode(line.substring(tabcount), depth);
      node.parent = levels[levels.length - 1];
      node.parent.children.push(node);
      levels.push(node);
    }
  }
  return tree;
};

exports.traverse = function (tree, cb) {
  function _traverse(node) {
    cb(node);
    for (var i = 0; i < node.children.length; i++) {
      _traverse(node.children[i]);
    }
  }
  for (var i = 0; i < tree.children.length; i++) {
    _traverse(tree.children[i]);
  }
};

exports.print = function (tree) {
  exports.traverse(tree, function (node) {
    var string = '';
    for (var i = 0; i < node.depth; i++) {
      string += '\t';
    }
    string += node.data;
    console.log(string);
  });
};

exports.toJSON = function (tree) {
  return JSON.stringify(tree.children);
};

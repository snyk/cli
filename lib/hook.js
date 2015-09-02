module.exports = function () {
  hookExtensions(['.js']);
};

var forEach = require('lodash').forEach;
var fs = require('fs');
var oldHandlers = {};
var snyk = require('..');

// source: https://github.com/joyent/node/blob/master/lib/module.js#L466
function stripBOM(content) {
  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFileSync()`
  // translates it to FEFF, the UTF-16 BOM.
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

function loader(module, filename) {
  snyk.bus.emit('before:module', filename);
  var content = fs.readFileSync(filename, 'utf8');
  module._compile(stripBOM(content), filename);
  snyk.bus.emit('after:module', module);
}

function registerExtension(ext) {
  var old = oldHandlers[ext] || oldHandlers['.js'] || require.extensions['.js'];

  require.extensions[ext] = function (m, filename) {
    if (snyk.isolate.okay(filename)) {
      loader(m, filename, old);
    }
  };
}


function hookExtensions(_exts) {
  forEach(oldHandlers, function (old, ext) {
    if (old === undefined) {
      delete require.extensions[ext];
    } else {
      require.extensions[ext] = old;
    }
  });

  oldHandlers = {};

  forEach(_exts, function (ext) {
    oldHandlers[ext] = require.extensions[ext];
    registerExtension(ext);
  });
}
// TODO: unhook
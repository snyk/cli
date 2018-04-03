module.exports = createSpinner;
module.exports.isRequired = true;

var debug = require('debug')('snyk:spinner');
var isCI = require('./is-ci');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var spinners = {};
var sticky = false;
var handleExit = false;

function createSpinner(label) {
  if (!label) {
    throw new Error('spinner requires a label');
  }

  if (spinners[label] === undefined) {
    spinners[label] = [];
  }

  // helper...
  return new Promise(function (resolve) {
    debug('spinner: %s', label);
    spinners[label].push(spinner({
      // string: '◐◓◑◒',
      stream: sticky ? process.stdout : process.stderr,
      interval: 75,
      label: label,
    }));

    resolve();
  });
}

createSpinner.sticky = function (s) {
  sticky = s === undefined ? true : s;
};

createSpinner.clear = function (label) {
  return function (res) {
    if (spinners[label] === undefined) {
      throw new Error('unknown spinner label: ' + label);
    }

    debug('clearing %s (%s)', label, spinners[label].length);
    if (spinners[label].length) {
      var s = spinners[label].pop();
      if (s) {
        s.clear();
      }
    }
    return res;
  };
};

createSpinner.clearAll = function () {
  Object.keys(spinners).map(function (lbl) {
    createSpinner.clear(lbl)();
  });
};

// taken from http://git.io/vWdUm and modified
function spinner(opt) {
  if (module.exports.isRequired || isCI) {
    return false;
  }
  debug('creating spinner');
  if (!opt) {opt = {};}
  var str = opt.stream || process.stderr;
  var tty = typeof opt.tty === 'boolean' ? opt.tty : true;
  var string = opt.string || '/-\\|';
  var ms = typeof opt.interval === 'number' ? opt.interval : 50;
  if (ms < 0) {ms = 0;}
  if (tty && !str.isTTY) {return false;}
  var CR = str.isTTY ? '\u001b[0G' : '\u000d';
  var CLEAR = str.isTTY ? '\u001b[2K' : '\u000d \u000d';

  var s = 0;
  var sprite = string.split('');
  var wrote = false;

  var delay = typeof opt.delay === 'number' ? opt.delay : 2;

  var interval = setInterval(function () {
    if (--delay >= 0) { return; }
    s = ++s % sprite.length;
    var c = sprite[s];
    str.write(c + ' ' + (opt.label || '') + CR);
    wrote = true;
  }, ms);

  var unref = typeof opt.unref === 'boolean' ? opt.unref : true;
  if (unref && typeof interval.unref === 'function') {
    interval.unref();
  }

  var cleanup = typeof opt.cleanup === 'boolean' ? opt.cleanup : true;
  if (cleanup && !handleExit) {
    handleExit = true;
    process.on('exit', function () {
      if (wrote) {
        str.write(CLEAR);
      }
    });
  }

  spinner.clear = function () {
    clearInterval(interval);
    // debug('spinner cleared');
    if (sticky) {
      str.write(CLEAR);
      str.write(opt.label + '\n');
    } else {
      str.write(CLEAR);
    }
  };

  return {
    clear: spinner.clear,
  };
}

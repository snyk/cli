module.exports = createSpinner;
module.exports.isRequired = true;

const debug = require('debug')('snyk:spinner');
const isCI = require('./is-ci').isCI;
const spinners = {};
let sticky = false;
let handleExit = false;

function createSpinner(label) {
  if (!label) {
    throw new Error('spinner requires a label');
  }

  if (spinners[label] === undefined) {
    spinners[label] = [];
  }

  // helper...
  return new Promise(((resolve) => {
    debug('spinner: %s', label);
    spinners[label].push(spinner({
      // string: '◐◓◑◒',
      stream: sticky ? process.stdout : process.stderr,
      interval: 75,
      label: label,
    }));

    resolve();
  }));
}

createSpinner.sticky = function (s) {
  sticky = s === undefined ? true : s;
};

createSpinner.clear = function (label) {
  return function (res) {
    if (spinners[label] === undefined) {
      // clearing a non-existend spinner is ok by default
      return res;
    }

    debug('clearing %s (%s)', label, spinners[label].length);
    if (spinners[label].length) {
      const s = spinners[label].pop();
      if (s) {
        s.clear();
      }
    }
    return res;
  };
};

createSpinner.clearAll = function () {
  Object.keys(spinners).map((lbl) => {
    createSpinner.clear(lbl)();
  });
};

// taken from http://git.io/vWdUm and modified
function spinner(opt) {
  if (module.exports.isRequired || isCI()) {
    return false;
  }
  debug('creating spinner');
  if (!opt) {
    opt = {};
  }
  const str = opt.stream || process.stderr;
  const tty = typeof opt.tty === 'boolean' ? opt.tty : true;
  const string = opt.string || '/-\\|';
  let ms = typeof opt.interval === 'number' ? opt.interval : 50;
  if (ms < 0) {
    ms = 0;
  }
  if (tty && !str.isTTY) {
    return false;
  }
  const CR = str.isTTY ? '\u001b[0G' : '\u000d';
  const CLEAR = str.isTTY ? '\u001b[2K' : '\u000d \u000d';

  let s = 0;
  const sprite = string.split('');
  let wrote = false;

  let delay = typeof opt.delay === 'number' ? opt.delay : 2;

  const interval = setInterval(() => {
    if (--delay >= 0) {
      return;
    }
    s = ++s % sprite.length;
    const c = sprite[s];
    str.write(c + ' ' + (opt.label || '') + CR);
    wrote = true;
  }, ms);

  const unref = typeof opt.unref === 'boolean' ? opt.unref : true;
  if (unref && typeof interval.unref === 'function') {
    interval.unref();
  }

  const cleanup = typeof opt.cleanup === 'boolean' ? opt.cleanup : true;
  if (cleanup && !handleExit) {
    handleExit = true;
    process.on('exit', () => {
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

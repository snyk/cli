import { SpinnerOptions } from './types';

export = createSpinner;
createSpinner.isRequired = true;

const util = require('util');
const debug = util.debuglog('snyk:spinner');
import { isCI } from './is-ci';
const spinners = {};
let sticky = false;
let handleExit = false;

function createSpinner(label: string): Promise<void> {
  if (!label) {
    throw new Error('spinner requires a label');
  }

  if (spinners[label] === undefined) {
    spinners[label] = [];
  }

  // helper...
  return new Promise((resolve) => {
    debug('spinner: %s', label);
    spinners[label].push(
      spinner({
        // string: '◐◓◑◒',
        stream: sticky ? process.stdout : process.stderr,
        interval: 75,
        label,
      }),
    );

    resolve();
  });
}

createSpinner.sticky = (s?: any) => {
  sticky = s === undefined ? true : s;
};

createSpinner.clear = <T>(label): ((valueToPassThrough: T) => T) => {
  return (res: T) => {
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

createSpinner.clearAll = () => {
  Object.keys(spinners).map((lbl) => {
    createSpinner.clear<void>(lbl)();
  });
};

// taken from http://git.io/vWdUm and modified
function spinner(opt: SpinnerOptions) {
  if (module.exports.isRequired || isCI()) {
    return false;
  }
  debug('creating spinner');
  if (!opt) {
    opt = {};
  }
  const str = opt.stream || process.stderr;
  const tty = typeof opt.tty === 'boolean' ? opt.tty : true;
  const stringOpt = opt.string || '/-\\|';
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
  const sprite = stringOpt.split('');
  let wrote = false;

  let delay = typeof opt.delay === 'number' ? opt.delay : 2;

  const interval = (setInterval(() => {
    if (--delay >= 0) {
      return;
    }
    s = ++s % sprite.length;
    const c = sprite[s];
    str.write(c + ' ' + (opt.label || '') + CR);
    wrote = true;
  }, ms) as unknown) as NodeJS.Timer;

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

  (spinner as any).clear = () => {
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
    clear: (spinner as any).clear,
  };
}

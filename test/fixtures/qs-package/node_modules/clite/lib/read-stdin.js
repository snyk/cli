'use strict';
module.exports = read;

function read() {
  if (process.stdin.isTTY || process.env.TAP) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    let data = '';

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}
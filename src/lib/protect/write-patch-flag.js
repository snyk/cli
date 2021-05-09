module.exports = writePatchFlag;

const util = require('util');
const debug = util.debuglog('snyk');
const fs = require('fs');
const path = require('path');

function writePatchFlag(now, vuln) {
  if (!vuln) {
    vuln = now;
    now = new Date();
  }

  debug('writing flag for %s', vuln.id);
  let promise;
  // the colon doesn't like Windows, ref: https://git.io/vw2iO
  const fileSafeId = vuln.id.replace(/:/g, '-');
  const flag = path.resolve(vuln.source, '.snyk-' + fileSafeId + '.flag');
  if (vuln.grouped && vuln.grouped.includes) {
    debug('found addition vulns to write flag files for');
    const writePromises = [];
    fs.writeFileSync(flag, now.toJSON(), 'utf8');
    vuln.grouped.includes.forEach(() => {
      const fileSafeId = vuln.id.replace(/:/g, '-');
      const flag = path.resolve(vuln.source, '.snyk-' + fileSafeId + '.flag');
      debug('Writing flag for grouped vulns', flag);
      writePromises.push();
      fs.writeFileSync(flag, now.toJSON(), 'utf8');
    });
    promise = Promise.all(writePromises);
  } else {
    debug('Writing flag for single vuln', flag);
    /* TODO:
      This piece is actually swallowing fs.writeFile errors!
      See the `promise.then` construct below.
      This should be refactored and tests should be updated.
    */
    promise = new Promise((r) => fs.writeFile(flag, now.toJSON(), 'utf8', r));
  }
  return promise.then(() => {
    return vuln;
  });
}

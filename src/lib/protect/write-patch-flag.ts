module.exports = writePatchFlag;

const debug = require('debug')('snyk');
const fs = require('then-fs');
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
    const writePromises = [fs.writeFile(flag, now.toJSON(), 'utf8')];
    vuln.grouped.includes.forEach(() => {
      const fileSafeId = vuln.id.replace(/:/g, '-');
      const flag = path.resolve(vuln.source, '.snyk-' + fileSafeId + '.flag');
      debug('Writing flag for grouped vulns', flag);
      writePromises.push(fs.writeFile(flag, now.toJSON(), 'utf8'));
    });
    promise = Promise.all(writePromises);
  } else {
    debug('Writing flag for single vuln', flag);
    promise = fs.writeFile(flag, now.toJSON(), 'utf8');
  }
  return promise.then(() => {
    return vuln;
  });
}

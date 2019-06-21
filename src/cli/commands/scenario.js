module.exports = scenario;
module.exports.loadScenario = loadScenario;

const debug = require('debug')('snyk');
const fs = require('then-fs');
const semver = require('semver');
const _ = require('lodash');
const snyk = require('../../lib');
const auth = require('./auth/is-authed');
const wizard = require('./protect/wizard');

function scenario(casefile, options) {
  const cache = {
    isAuthed: auth.isAuthed,
    test: snyk.test,
  };
  auth.isAuthed = function () {
    return Promise.resolve(true);
  };
  return loadScenario(casefile).then((data) => {
    snyk.test = scenarioTest(data);
    options['dry-run'] = true;
    console.log(data.title || 'Unknown case');
    debug(JSON.stringify(data, '', 2));
    // process.exit(1);
    return wizard(options);
  }).then((res) => {
    snyk.test = cache.test;
    auth.isAuthed = cache.isAuthed;
    return res;
  });
}

function loadScenario(casefile) {
  if (casefile.indexOf('.json') === -1) {
    return fs.readFile(casefile, 'utf8').then(parseScenario);
  }

  return fs.readFile(casefile, 'utf8').then(JSON.parse);
}

function scenarioTest(data) {
  return function () {
    return new Promise(((resolve) => {
      resolve({
        ok: false,
        vulnerabilities: data.vulnerabilities.slice(0),
      });
    }));
  };
}

function parseScenario(source) {
  const pkg = {};
  const data = {};
  let vulnerabilities = [];
  const title = /^title:\s+(.*)$/im;
  const vuln = /([A-Za-z]\-\d+) has.*vuln(?:.*in ([A-Za-z]\-\d+))?/mgi;
  const vulnIds = /([Vv]\d+)/mgi;
  // jscs:disable
  const uses = /([A-Za-z]\-\d+|App|app) uses ([A-Za-z]\-\d+)(?: and ([A-Za-z]\-\d+))*/mgi;
  // jscs:enable
  const module = /([A-Za-z]\-\d+|App)/gi;
  const patches = /([Pp]\d+) fixes (?:.*([Vv]\d+)+.*in (\w+))?/mgi;
  let m;

  pkg.name = 'app';
  pkg.version = '0.0.0';
  pkg.full = pkg.name + '@' + pkg.version;
  pkg.dependencies = {};
  pkg.path = [pkg.full];

  const packages = {};
  let k;
  let p;
  let i;
  let path;

  const lines = source.trim().split('\n').map(trim);
  for (i = 0; i < lines.length; i++) {
    const line = lines[i];
    debug('>>> %s', line);

    // reset all the indicies of the regexp
    uses.lastIndex = 0;
    title.lastIndex = 0;
    vulnIds.lastIndex = 0;
    module.lastIndex = 0;
    patches.lastIndex = 0;

    if ((m = title.exec(line)) !== null) {
      data.title = m[0];
      continue;
    }

    // create the relationships
    if (line.indexOf(' uses ') !== -1) {
      if ((m = uses.exec(line)) !== null) {
        if (m[1] === 'App') {
          debug('App uses...', line);
          m.slice(2).filter(Boolean).map((module) => {
            const p = module.split('-');
            p[1] = cleanVersion(p[1]);
            pkg.dependencies[p[0]] = {
              name: p[0],
              version: p[1],
              full: p.join('@'),
              path: [],
              dependencies: {},
            };
          }); // jshint ignore:line
          m.shift();
        }

        p = m[1].split('-');
        p[1] = cleanVersion(p[1]);
        const full = p.join('@');
        if (!packages[full]) {
          packages[full] = {
            dependencies: {},
          };
        }
        debug('packages', packages, full);

        m.slice(2).filter(Boolean).map((module) => {
          const p = module.split('-');
          p[1] = cleanVersion(p[1]);
          debug('package module: %s', module, p.join('@'));
          packages[full].dependencies[p[0]] = {
            name: p[0],
            version: p[1],
            full: p.join('@'),
            path: [],
            dependencies: {},
          };
        }); // jshint ignore:line
      }

      continue;
    }

    if (line.indexOf(' fixes ') !== -1) {
      debug('found fixes...');

      const vulns = line.match(vulnIds) || [, 'V1'];
      debug('vulns found? ', vulns);
      if ((m = patches.exec(line)) !== null) {
        for (k = 0; k < vulns.length; k++) {
          vulnerabilities.forEach((vuln) => {
            if (vuln.id === vulns[k]) {
              if (!vuln.patches) {
                vuln.patches = [];
              }

              vuln.patches.push({
                urls: ['https://example.com/patches/' + m[1]],
                version: '*',
                id: 'patch:' + m[1],
                modificationTime: patchDate(m.slice(-1).pop()),
              });
            }
          }); // jshint ignore:line
        }

      }

      continue;
    }

    if (line.indexOf(' has ') !== -1) {
      debug('vuln found');
      vuln.lastIndex = 0;
      if ((m = vuln.exec(line)) !== null) {
        const vulnIn = (m[1]).split('-');
        vulnIn[1] = cleanVersion(vulnIn[1]);
        const fixedIn = (m[2] || '-<0.0.0').split('-'); // there is no fix
        fixedIn[1] = cleanVersion(fixedIn[1]);

        if (!packages[fixedIn.join('@')]) {
          packages[fixedIn.join('@')] = {
            dependencies: {},
          };
        }

        m = line.match(vulnIds);
        if (m === null) {
          m = ['V1'];
        }
        debug('vulnIds', m, line);

        for (k = 0; k < m.length; k++) {
          const v = m[k];

          // first check if the vuln exists
          const match = vulnerabilities.filter((vuln) => {
            return vuln.id === v;
          }); // jshint ignore:line

          if (match.length) {
            match[0].semver = {
              vulnerable: vulnIn[1],
              patched: fixedIn[1],
            };
            match[0].from = [pkg.name + '@' + pkg.version, vulnIn.join('@')];
            path = !fixedIn[0] ? false : fixedIn.join('@');
            match[0].upgradePath = [false, path];
            continue;
          }

          const vulnerability = {
            moduleName: vulnIn[0],
            id: v,
            name: vulnIn[0],
            version: vulnIn[1],
            below: vulnIn[1],
            semver: {
              vulnerable: vulnIn[1],
              patched: fixedIn[1],
            },
            severity: 'high',
            info: ['https://example.com/vuln/' + v],
          };

          const fullfrom = pkg.name + '@' + pkg.version;
          vulnerability.from = [fullfrom, vulnIn.join('@')];
          path = !fixedIn[0] ? false : fixedIn.join('@');
          vulnerability.upgradePath = [false, path];

          vulnerabilities.push(vulnerability);
        }
        continue;
      }
    }
  }

  const deps = Object.keys(pkg.dependencies);
  if (deps.length === 0) {
    pkg.dependencies = false;
  } else {
    // clean up (and join) dependencies
    cleanDepTree(deps, pkg, packages);
  }

  vulnerabilities = vulnerabilities.filter((vuln) => {
    debug('checking new vuln: %s', vuln.id);
    let p;
    let i;
    const match = matchDep(vuln.name + '@' + vuln.version, pkg.dependencies);
    if (match) {
      vuln.from = match.path.slice(0);
      vuln.upgradePath = [];
      let name = vuln.name;
      let dirty = false;
      let target = vuln.name + '@' + vuln.semver.patched;

      const packagesFull = Object.keys(packages);
      for (i = 0; i < packagesFull.length; i++) {
        p = packagesFull[i];
        debug('checking for deep %s ~ %s', p, name);

        if (packages[p].dependencies[name]) {
          debug('found matching package %s', name);
          const v = target.split('@').pop();
          debug('semver.satisfies(%s, %s) === %s',
            packages[p].dependencies[name].version,
            v,
            semver.satisfies(packages[p].dependencies[name].version, v));

          if (semver.satisfies(packages[p].dependencies[name].version, v)) {
            debug('target found: %s', target);
            vuln.upgradePath.unshift(target);
            target = p;
            dirty = true;
            name = p.split('@')[0];
            i = 0;
            continue;
          }
        }
      }

      if (dirty === false) {
        for (i = 0; i < packagesFull.length; i++) {
          p = packagesFull[i];

          debug('checking shallow');

          if (p === target && dirty === false) {
            debug('target direct found: %s', target);
            vuln.upgradePath.unshift(target);
            name = p.split('@')[0];
            i = 0;

            break;
          }
        }
      }

      if (dirty) {
        vuln.upgradePath.unshift(target);
      }

      // now match the lengths
      const length = vuln.from.length - vuln.upgradePath.length;
      for (i = 0; i < length; i++) {
        vuln.upgradePath.unshift(false);
      }

      return true;
    }

    debug('no match for vuln');
  });

  data.pkg = pkg;
  data.packages = packages;
  data.vulnerabilities = vulnerabilities;

  return data;
}

function cleanDepTree(deps, pkg, packages) {
  deps.forEach((curr) => {
    const full = pkg.dependencies[curr].full;
    debug('push on %s with %s', pkg.dependencies[curr].path, pkg.full);
    pkg.dependencies[curr].path = pkg.path.concat(pkg.dependencies[curr].path);
    pkg.dependencies[curr].path.push(pkg.dependencies[curr].full);
    if (packages[full]) {
      pkg.dependencies[curr].dependencies =
        _.cloneDeep(packages[full].dependencies);
      cleanDepTree(
        Object.keys(pkg.dependencies[curr].dependencies),
        pkg.dependencies[curr],
        packages
      );
    } else {
      pkg.dependencies[curr].dependencies = false;
    }
  });
}

function trim(s) {
  return s.trim();
}

function cleanVersion(s) {
  if (!s) {
    s = '0';
  }
  const version = s.split('.');
  if (version.length === 1) {
    return s + '.0.0';
  }

  if (version.length === 2) {
    return s + '.0';
  }

  return s;
}

function matchDep(module, deps) {
  const keys = Object.keys(deps);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (deps[key].full === module) {
      return deps[key];
    }

    if (deps[key].dependencies) {
      return matchDep(module, deps[key].dependencies);
    }
  }

  return false;
}

function patchDate(s) {
  s = (s || '').toLowerCase();
  const d = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep',
    'oct', 'nov', 'dec'].map((d, i) => {
    return s.indexOf(d) === 0 ? i : false;
  }).filter(Boolean);
  const date = new Date();

  if (d.length) {
    date.setMonth(d[0]);
  }
  return date.toJSON();
}

/*
Title: Direct upgrade
A-1 has vuln V1, fixed in A-2
App uses A-1



{
  "name": "qs-package",
  "version": "1.0.0",
  "license": "ISC",
  "depType": "extraneous",
  "hasDevDependencies": true,
  "full": "qs-package@1.0.0",
  "dependencies": {
    "qs": {
      "name": "qs",
      "version": "0.6.6",
      "full": "qs@0.6.6",
      "valid": true,
      "devDependencies": {
        "mocha": "*",
        "expect.js": "*"
      },
      "depType": "prod",
      "license": "none",
      "dep": "^0.6.6",
      "dependencies": false
    }
  }
}
 */

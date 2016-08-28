module.exports = scenario;
module.exports.loadScenario = loadScenario;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var semver = require('semver');
var _ = require('../../dist/lodash-min');
var snyk = require('../../lib');
var auth = require('./auth');
var wizard = require('./protect/wizard');

function scenario(casefile, options) {
  var cache = {
    isAuthed: auth.isAuthed,
    test: snyk.test,
  };
  auth.isAuthed = function () {
    return Promise.resolve(true);
  };
  return loadScenario(casefile).then(function (data) {
    snyk.test = scenarioTest(data);
    options['dry-run'] = true;
    console.log(data.title || 'Unknown case');
    debug(JSON.stringify(data, '', 2));
    // process.exit(1);
    return wizard(options);
  }).then(function (res) {
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
    return new Promise(function (resolve) {
      resolve({
        ok: false,
        vulnerabilities: data.vulnerabilities.slice(0),
      });
    });
  };
}

function parseScenario(source) {
  var pkg = {};
  var data = {};
  var vulnerabilities = [];
  var title = /^title:\s+(.*)$/im;
  var vuln = /([A-Za-z]\-\d+) has.*vuln(?:.*in ([A-Za-z]\-\d+))?/mgi;
  var vulnIds = /([Vv]\d+)/mgi;
  // jscs:disable
  var uses = /([A-Za-z]\-\d+|App|app) uses ([A-Za-z]\-\d+)(?: and ([A-Za-z]\-\d+))*/mgi;
  // jscs:enable
  var module = /([A-Za-z]\-\d+|App)/gi;
  var patches = /([Pp]\d+) fixes (?:.*([Vv]\d+)+.*in (\w+))?/mgi;
  var m;

  pkg.name = 'app';
  pkg.version = '0.0.0';
  pkg.full = pkg.name + '@' + pkg.version;
  pkg.dependencies = {};
  pkg.path = [pkg.full];

  var packages = {};
  var k;
  var p;
  var i;
  var path;

  var lines = source.trim().split('\n').map(trim);
  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
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
          m.slice(2).filter(Boolean).map(function (module) {
            var p = module.split('-');
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
        var full = p.join('@');
        if (!packages[full]) {
          packages[full] = {
            dependencies: {},
          };
        }
        debug('packages', packages, full);

        m.slice(2).filter(Boolean).map(function (module) {
          var p = module.split('-');
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

      var vulns = line.match(vulnIds) || [, 'V1'];
      debug('vulns found? ', vulns);
      if ((m = patches.exec(line)) !== null) {
        for (k = 0; k < vulns.length; k++) {
          vulnerabilities.forEach(function (vuln) {
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
        var vulnIn = (m[1]).split('-');
        vulnIn[1] = cleanVersion(vulnIn[1]);
        var fixedIn = (m[2] || '-<0.0.0').split('-'); // there is no fix
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
          var v = m[k];

          // first check if the vuln exists
          var match = vulnerabilities.filter(function (vuln) {
            return vuln.id === v;
          }); // jshint ignore:line

          if (match.length) {
            match[0].semver = {
              vulnerable: vulnIn[1],
              patched: fixedIn[1],
            };
            match[0].from = [ pkg.name + '@' + pkg.version, vulnIn.join('@') ];
            path = !fixedIn[0] ? false : fixedIn.join('@');
            match[0].upgradePath = [ false, path ];
            continue;
          }

          var vulnerability = {
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

          var fullfrom = pkg.name + '@' + pkg.version;
          vulnerability.from = [ fullfrom, vulnIn.join('@') ];
          path = !fixedIn[0] ? false : fixedIn.join('@');
          vulnerability.upgradePath = [ false, path ];

          vulnerabilities.push(vulnerability);
        }
        continue;
      }
    }
  }

  var deps = Object.keys(pkg.dependencies);
  if (deps.length === 0) {
    pkg.dependencies = false;
  } else {
    // clean up (and join) dependencies
    cleanDepTree(deps, pkg, packages);
  }

  vulnerabilities = vulnerabilities.filter(function (vuln) {
    // console.log(vuln);
    debug('checking new vuln: %s', vuln.id);
    var p;
    var match = matchDep(vuln.name + '@' + vuln.version, pkg.dependencies);
    if (match) {
      vuln.from = match.path.slice(0);
      vuln.upgradePath = [];
      var name = vuln.name;
      var dirty = false;
      var target = vuln.name + '@' + vuln.semver.patched;

      var packagesFull = Object.keys(packages);
      for (var i = 0; i < packagesFull.length; i++) {
        p = packagesFull[i];
        debug('checking for deep %s ~ %s', p, name);

        if (packages[p].dependencies[name]) {
          debug('found matching package %s', name);
          var v = target.split('@').pop();
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
      var length = vuln.from.length - vuln.upgradePath.length;
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
  deps.forEach(function (curr) {
    var full = pkg.dependencies[curr].full;
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
  var version = s.split('.');
  if (version.length === 1) {
    return s + '.0.0';
  }

  if (version.length === 2) {
    return s + '.0';
  }

  return s;
}

function matchDep(module, deps) {
  var keys = Object.keys(deps);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
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
  var d = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep',
    'oct', 'nov', 'dec', ].map(function (d, i) {
    return s.indexOf(d) === 0 ? i : false;
  }).filter(Boolean);
  var date = new Date();

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

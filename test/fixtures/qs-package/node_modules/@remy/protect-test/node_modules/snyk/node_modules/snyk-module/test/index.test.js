var tape = require('tape');
var mod = require('../');

tape('module string to object', function (t) {
  t.deepEqual(mod('nodemon'), { name: 'nodemon', version: '*' }, 'supports versionless');
  t.deepEqual(mod('nodemon@1'), { name: 'nodemon', version: '1' }, 'with version');
  // t.throws(function () { mod('@remy/snyk-module'); }, /not supported: private module/, 'private not supported');
  t.throws(function () { mod('grunt-sails-linker@git://github.com/Zolmeister/grunt-sails-linker.git'); }, /not supported: external module/, 'external not supported');
  t.throws(function () { return mod('ikt@git+http://ikt.pm2.io/ikt.git#master'); }, /not supported: external module/, 'external not supported');

  t.end();
});

tape('encoding', function (t) {
  t.equal(mod.encode('snyk'), 'snyk', 'vanilla strings unaffected');
  t.equal(mod.encode('@snyk/config'), '@snyk%2Fconfig', 'slash is escaped');
  t.end();
});
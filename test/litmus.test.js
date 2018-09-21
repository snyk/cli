'use strict';
var test = require('tape');

test('does it load', function (t) {
  var snyk = require('../src/lib');
  t.assert(snyk, 'snyk loaded');
  t.end();
});

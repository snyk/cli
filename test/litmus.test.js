'use strict';
var test = require('tape');

test('does it load', function (t) {
  var snyk = require('../');
  t.assert(snyk, 'snyk loaded');
  t.end();
});
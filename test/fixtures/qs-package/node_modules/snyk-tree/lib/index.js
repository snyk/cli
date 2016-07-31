#!/usr/bin/env node
var archy = require('./archy');
process.stdin.resume();
process.stdin.setEncoding('utf8');

var data = '';
process.stdin.on('data', function (_) { data += _; });
process.stdin.on('end', function () {
  console.log(archy(JSON.parse(data)));
});
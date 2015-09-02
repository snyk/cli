'use strict';
/*global describe:true, it: true */
var cache = require('../')();
var tests = require(__dirname + '/../node_modules/autocache-localstorage/test/localstorage.test');

tests(cache);
'use strict';
/*global describe:true, it: true */
var cache = require('../')();
var tests = require(__dirname + '/../node_modules/autocache-redis/test/redis.test');

tests(cache);
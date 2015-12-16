module.exports = analyics;

var snyk = require('./');
var config = require('./config');
var version = require('./version');
var request = require('./request');
var isCI = require('./is-ci');
var debug = require('debug')('snyk');
var os = require('os');
var interfaces = os.networkInterfaces() || os.getNetworkInterfaces();
var crypto = require('crypto');
var shasum = crypto.createHash('sha1');

var metadata = {};

function analyics(data) {
  // if the user opt'ed out of analytics, then let's bail out early
  if (snyk.config['disable-analyics']) {
    return Promise.resolve();
  }

  // merge any new data with data we picked up along the way
  if (Array.isArray(data.args)) {
    // this is an overhang from the args.js and we don't want it
    delete (data.args.slice(-1).pop() || {})._;
  }

  if (Object.keys(metadata).length) {
    data.metadata = metadata;
  }

  // get fingerprint from mac address
  // snyk version
  return version().then(function (version) {
    data.version = version;

    var mac = getMAC() || Math.random(); // ¯\_(ツ)_/¯
    data.id = shasum.update(mac).digest('hex');

    var headers = {};
    if (snyk.api) {
      headers.authorization = 'token ' + snyk.api;
    }

    data.ci = isCI;

    debug(data);

    return request({
      body: {
        data: data,
      },
      url: config.API + '/analytics/cli',
      json: true,
      method: 'post',
      headers: headers,
    });
  }).catch(function (error) {
    debug(error); // this swallows the analytics error
  });
}

analyics.reset = function () {
  metadata = {};
};

analyics.add = function (key, value) {
  debug('add', key, value);
  metadata[key] = value;
};

// via http://git.io/v0Xze
// because we can't just pick the first mac address :-\
function getMAC() {
  var name;
  return Object.keys(interfaces).sort().reduce(function (acc, curr) {
    if (curr.indexOf('en') === 0 && name.indexOf('en') === -1) {
      name = curr;
      return interfaces[curr][0].address;
    }

    if (acc) {
      return acc;
    }

    if (curr.indexOf('lo') === -1 && interfaces[curr].length) {
      name = curr;
      return interfaces[curr][0].address;
    }
  }, '');
}
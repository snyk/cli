var Promise = require('es6-promise').Promise
var snyk = require('./');
var request = require('./request');
var config = require('./config');

function actionAllowed (action, options) {
  return new Promise(function (resolve, reject) {
    request({
      method: 'GET',
      url: config.API + '/authorization/' + action,
      json: true,
      headers: {
        authorization: 'token ' + snyk.api,
      },
      qs: options.org && {org: options.org},
    }, function (error, res, body) {
      if (error) {
        return reject(error);
      }
      if (body.error) {
        return reject(body.error);
      }
      resolve(body.result);
    });
  });
}

module.exports = {
  actionAllowed: actionAllowed,
};

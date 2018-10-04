var snyk = require('./');
var request = require('./request');
var config = require('./config');

function actionAllowed(action, options) {
  const org = options.org || config.org || null;
  return new Promise(function (resolve, reject) {
    request({
      method: 'GET',
      url: config.API + '/authorization/' + action,
      json: true,
      headers: {
        authorization: 'token ' + snyk.api,
      },
      qs: org && {org},
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

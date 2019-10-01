const snyk = require('./');
const request = require('./request');
const config = require('./config');

function actionAllowed(action, options) {
  const org = options.org || config.org || null;
  return new Promise((resolve, reject) => {
    request(
      {
        method: 'GET',
        url: config.API + '/authorization/' + action,
        json: true,
        headers: {
          authorization: 'token ' + snyk.api,
        },
        qs: org && { org },
      },
      (error, res, body) => {
        if (error) {
          return reject(error);
        }
        if (body.error) {
          return reject(body.error);
        }
        resolve(body.result);
      },
    );
  });
}

module.exports = {
  actionAllowed: actionAllowed,
};

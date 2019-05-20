import * as snyk from '../../../lib';
import * as config from '../../../lib/config';
import * as request from '../../../lib/request';

export function isAuthed() {
  const token = snyk.config.get('api');
  return verifyAPI(token).then((res: any) => {
    return res.body.ok;
  });
}

export function verifyAPI(api) {
  const payload = {
    body: {
      api,
    },
    method: 'POST',
    url: config.API + '/verify/token',
    json: true,
  };

  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      resolve({
        res,
        body,
      });
    });
  });
}

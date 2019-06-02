import * as snyk from '../../../lib';
import * as config from '../../../lib/config';
import * as request from '../../../lib/request';

export async function isAuthed() {
  const token = snyk.config.get('api');
  const res = await verifyAPI(token);
  return res.body.ok;
}

export async function verifyAPI(apiToken) {
  const payload = {
    body: {
      api: apiToken,
    },
    method: 'POST',
    url: config.API + '/verify/token',
    json: true,
  };

  const verifyTokenRes = await request(payload);
  const {error, res, body} = verifyTokenRes;
  if (error) {
    throw error;
  }

  return {
    res,
    body,
  };
}
